// run-status — refresh one run: roll up its event counts, read Make's execution log
// to close the run (success/warning/error), and reset the run_control record to ALL.
// Called by the live page every 8 s while a run is open.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, json, admin, requireAllowed, config, makeApi } from "../_shared.ts";

const STATUS: Record<number, string> = { 1: "success", 2: "warning", 3: "error" };

async function resetControl(cfg: Record<string, string>) {
  if (!cfg.make_api_token || !cfg.make_datastore_id) return;
  await makeApi(`/data-stores/${cfg.make_datastore_id}/data/run_control`, {
    method: "PUT", body: JSON.stringify({ county: "ALL", run_id: "", requested_by: "", requested_at: "" }),
  }, cfg).catch(() => null);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, message: "POST only" }, 405);
  const { user } = await requireAllowed(req);
  if (!user) return json({ ok: false, message: "Not authorized." }, 401);

  const body = await req.json().catch(() => ({}));
  const run_id = typeof body?.run_id === "string" ? body.run_id : null;
  if (!run_id) return json({ ok: false, message: "run_id required" }, 400);

  const db = admin();
  const { data: run } = await db.from("runs").select("*").eq("id", run_id).maybeSingle();
  if (!run) return json({ ok: false, message: "Unknown run." }, 404);

  const { data: ev } = await db.from("events").select("outcome, note").eq("run_id", run_id);
  const rows = ev ?? [];
  const summary = {
    received: rows.filter((r) => r.outcome === "RECEIVED").length,
    new_foreclosures: rows.filter((r) => r.outcome === "New foreclosure row").length,
    nts_joins: rows.filter((r) => (r.outcome ?? "").startsWith("Joined")).length,
    cancellations: rows.filter((r) => r.outcome === "Cancellation recorded").length,
    needs_review: rows.filter((r) => /NEEDS REVIEW/i.test(r.note ?? "")).length,
  };

  if (run.status === "running" || run.status === "queued") {
    const cfg = await config(["make_api_token", "make_api_base", "make_scenario_id", "make_datastore_id"]);
    if (cfg.make_api_token) {
      // Make returns { scenarioLogs: [{ id, status, timestamp, duration, endedAt, ... }] }; executionId is null, match on id
      const logs = await makeApi(`/scenarios/${cfg.make_scenario_id}/logs?pg[limit]=5`, { method: "GET" }, cfg);
      const items: any[] = Array.isArray(logs.body?.scenarioLogs) ? logs.body.scenarioLogs : Array.isArray(logs.body) ? logs.body : [];
      const mine = items.find((l) => run.make_execution_id && (l.executionId === run.make_execution_id || l.id === run.make_execution_id))
        ?? items.find((l) => new Date(l.timestamp ?? 0).getTime() >= new Date(run.started_at).getTime() - 120e3);
      const code = mine?.status;
      const isEnd = !!mine?.duration || !!mine?.endedAt;
      if (typeof code === "number" && STATUS[code] && isEnd) {
        const ended = mine.endedAt || new Date(new Date(mine.timestamp).getTime() + (mine.duration ?? 0)).toISOString();
        await db.from("runs").update({
          status: STATUS[code], ended_at: ended, doc_count: summary.received, summary,
          make_execution_id: run.make_execution_id ?? mine.executionId ?? mine.id ?? null,
        }).eq("id", run_id);
        await resetControl(cfg);
        return json({ ok: true, run: { ...run, status: STATUS[code], ended_at: ended, doc_count: summary.received, summary } });
      }
    }
    // safety: a run open for more than an hour is closed as a warning
    if (Date.now() - new Date(run.started_at).getTime() > 60 * 60e3) {
      await db.from("runs").update({ status: "warning", ended_at: new Date().toISOString(), doc_count: summary.received, summary }).eq("id", run_id);
      await resetControl(cfg);
      return json({ ok: true, run: { ...run, status: "warning", doc_count: summary.received, summary } });
    }
    await db.from("runs").update({ doc_count: summary.received, summary }).eq("id", run_id);
  }
  return json({ ok: true, run: { ...run, doc_count: summary.received, summary } });
});

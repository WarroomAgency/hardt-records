// run — start a PROD run for one county (or ALL).
// 1) allowlisted user only  2) refuse if a run is already in flight
// 3) insert runs row  4) write Make data-store record run_control {county, run_id}
// 5) POST Make API scenarios/{id}/run  6) mark running
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, json, admin, requireAllowed, config, makeApi } from "../_shared.ts";

const COUNTIES = ["Kern County", "San Diego County", "San Bernardino County", "Riverside County", "ALL"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, message: "POST only" }, 405);

  const { user } = await requireAllowed(req);
  if (!user) return json({ ok: false, message: "Not authorized." }, 401);

  const body = await req.json().catch(() => ({}));
  const county = COUNTIES.includes(body?.county) ? body.county : null;
  if (!county) return json({ ok: false, message: "Pick a county." }, 400);

  const cfg = await config(["make_api_token", "make_api_base", "make_scenario_id", "make_datastore_id"]);
  if (!cfg.make_api_token || !cfg.make_datastore_id) {
    return json({ ok: false, message: "Running from here is being connected. For now, ask Michael to kick it off." }, 503);
  }

  const db = admin();
  const { data: active } = await db.from("runs").select("id, county, started_at")
    .in("status", ["queued", "running"])
    .gte("started_at", new Date(Date.now() - 60 * 60e3).toISOString())
    .limit(1);
  if (active && active.length) {
    return json({ ok: false, message: `A run is already in progress (${active[0].county}). Let it finish first.`, run_id: active[0].id }, 409);
  }

  const { data: run, error } = await db.from("runs")
    .insert({ county, status: "queued", triggered_by: user.email })
    .select("id").single();
  if (error || !run) return json({ ok: false, message: "Could not create the run." }, 500);

  const record = { county, run_id: run.id, requested_by: user.email, requested_at: new Date().toISOString() };
  const ds = cfg.make_datastore_id;
  let put = await makeApi(`/data-stores/${ds}/data/run_control`, { method: "PUT", body: JSON.stringify(record) }, cfg);
  if (!put.ok && put.status === 404) {
    put = await makeApi(`/data-stores/${ds}/data`, { method: "POST", body: JSON.stringify({ key: "run_control", data: record }) }, cfg);
  }
  if (!put.ok) {
    await db.from("runs").update({ status: "error", ended_at: new Date().toISOString(), summary: { error: "control record", detail: put.body } }).eq("id", run.id);
    return json({ ok: false, message: "Could not hand the county to the automation." }, 502);
  }

  const started = await makeApi(`/scenarios/${cfg.make_scenario_id}/run`, { method: "POST", body: JSON.stringify({ responsive: false }) }, cfg);
  if (!started.ok) {
    const already = /already/i.test(JSON.stringify(started.body ?? ""));
    await db.from("runs").update({ status: "error", ended_at: new Date().toISOString(), summary: { error: "start", detail: started.body } }).eq("id", run.id);
    return json({ ok: false, message: already ? "The automation is already running. Give it a few minutes." : "The automation did not start." }, 502);
  }

  const execId = started.body?.executionId ?? started.body?.id ?? null;
  await db.from("runs").update({ status: "running", make_execution_id: execId }).eq("id", run.id);
  return json({ ok: true, run_id: run.id, message: `Run started for ${county === "ALL" ? "all counties" : county}.` });
});

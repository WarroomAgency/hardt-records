import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { callFunction } from "@/lib/functions";
import { PageHeader, Stat } from "@/components/ui";
import { COUNTIES, fmtDateTime, shortCounty } from "@/lib/format";
import { RunTile, type QueueCounts } from "./run-tile";

type Session = {
  id: number; started_at: string; ended_at: string; counties: string[];
  docs_received: number; new_foreclosures: number; nts_joins: number; cancellations: number; needs_review: number;
};
type ActiveRun = { id: string; county: string; status: string; started_at: string; triggered_by: string | null };

export default async function RunConsole() {
  const supabase = await createClient();
  const since7 = new Date(Date.now() - 7 * 864e5).toISOString();

  const [{ data: sessions }, { data: week }, { count: reviewCount }, { data: active }, queue] = await Promise.all([
    supabase.from("run_sessions").select("*").order("started_at", { ascending: false }).limit(400),
    supabase.from("events").select("county, outcome, note").gte("ts", since7),
    supabase.from("documents").select("*", { count: "exact", head: true }).eq("needs_review", true),
    supabase.from("runs").select("id, county, status, started_at, triggered_by").in("status", ["queued", "running"]).order("started_at", { ascending: false }).limit(1),
    callFunction("queue", {}),
  ]);

  const weekRows = (week ?? []) as { county: string | null; outcome: string | null; note: string | null }[];
  const weekNew = weekRows.filter((r) => r.outcome === "New foreclosure row").length;
  const weekCancel = weekRows.filter((r) => r.outcome === "Cancellation recorded").length;
  const weekReceived = weekRows.filter((r) => r.outcome === "RECEIVED").length;

  const lastByCounty = new Map<string, Session>();
  for (const s of (sessions ?? []) as Session[]) {
    for (const c of s.counties ?? []) if (!lastByCounty.has(c)) lastByCounty.set(c, s);
  }
  const latest = (sessions ?? [])[0] as Session | undefined;
  const inFlight = ((active ?? []) as ActiveRun[])[0];

  const counts = (queue.status === 200 && (queue.json as { counts?: Record<string, QueueCounts> }).counts) || null;
  const queueError = counts ? null : ((queue.json as { message?: string }).message ?? "unavailable");

  return (
    <>
      <PageHeader
        eyebrow="Run console"
        title="County records"
        line="Drop the recorder pull into the county folder, then run it from here."
      />

      {inFlight && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4" style={{ borderLeftColor: "var(--color-bronze)" }}>
          <div>
            <div className="eyebrow">Run in progress</div>
            <div className="mt-1">{shortCounty(inFlight.county === "ALL" ? "All counties" : inFlight.county)} · started {fmtDateTime(inFlight.started_at)}{inFlight.triggered_by ? ` by ${inFlight.triggered_by}` : ""}</div>
          </div>
          <Link href={`/runs/live/${inFlight.id}`} className="btn btn-primary">Watch it</Link>
        </div>
      )}

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Stat label="Documents, last 7 days" value={weekReceived} sub="received across all counties" />
        <Stat label="New foreclosures, 7 days" value={weekNew} />
        <Stat label="Cancellations, 7 days" value={weekCancel} />
        <Stat label="Needs review" value={reviewCount ?? 0} sub="open items" tone={(reviewCount ?? 0) > 0 ? "alert" : "default"} />
      </section>

      <section className="mb-10">
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-xl">Run a county</h2>
          <Link href="/runs" className="link text-sm">All runs</Link>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {COUNTIES.map((c) => {
            const last = lastByCounty.get(c);
            return (
              <RunTile
                key={c}
                county={c}
                queued={counts ? counts[c] ?? {} : null}
                queueError={queueError}
                lastRunLabel={last ? `Last run ${fmtDateTime(last.started_at)}` : "No runs yet"}
                lastRunSummary={last ? `${last.docs_received} docs · ${last.new_foreclosures} new · ${last.cancellations} cancelled` : ""}
                lastRunHref={last ? `/runs/${last.id}` : undefined}
              />
            );
          })}
        </div>
      </section>

      {latest && (
        <section>
          <h2 className="text-xl mb-4">Most recent run</h2>
          <div className="card p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="eyebrow">{(latest.counties ?? []).map(shortCounty).join(" + ")}</div>
              <div className="mt-1 text-lg font-display font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
                {fmtDateTime(latest.started_at)}
              </div>
              <div className="text-sm text-gray mt-1">
                {latest.docs_received} received · {latest.new_foreclosures} new foreclosures · {latest.nts_joins} joined · {latest.cancellations} cancellations
                {latest.needs_review > 0 && <> · <span className="text-alert">{latest.needs_review} need review</span></>}
              </div>
            </div>
            <Link href={`/runs/${latest.id}`} className="btn btn-ghost">Open run</Link>
          </div>
        </section>
      )}
    </>
  );
}

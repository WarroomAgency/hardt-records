"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Chip, PageHeader, PdfLink, Stat } from "@/components/ui";
import { cleanAddress, fmtDateTime, fmtTime, outcomeChip, shortCounty } from "@/lib/format";

export type LiveEvent = { id: number; ts: string | null; county: string | null; doc_type: string | null; doc_number: string | null; pdf_url: string | null; address: string | null; outcome: string | null; note: string | null };
export type RunRow = { id: string; county: string; status: string; started_at: string; ended_at: string | null; triggered_by: string | null; doc_count: number; summary: Record<string, number> | null };

const TERMINAL = new Set(["success", "warning", "error"]);

export function LiveRun({ run: initialRun, initialEvents }: { run: RunRow; initialEvents: LiveEvent[] }) {
  const [run, setRun] = useState(initialRun);
  const [events, setEvents] = useState<LiveEvent[]>(initialEvents);
  // null until mounted so the server and client render the same markup
  const [now, setNow] = useState<number | null>(null);
  const seen = useRef(new Set(initialEvents.map((e) => e.id)));
  const live = !TERMINAL.has(run.status);

  // realtime: new events for this run (unique topic + cancel guard survives StrictMode double-mount)
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`run-${run.id}-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events", filter: `run_id=eq.${run.id}` }, (payload) => {
          const e = payload.new as LiveEvent;
          if (seen.current.has(e.id)) return;
          seen.current.add(e.id);
          setEvents((prev) => [...prev, e]);
        })
        .subscribe();
    });
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [run.id]);

  // clock starts after mount
  useEffect(() => {
    setNow(Date.now());
    if (!live) return;
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(c);
  }, [live]);

  // status polling while the run is open (also drives closing the run on the server)
  useEffect(() => {
    if (!live) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/run-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ run_id: run.id }) });
        const j = await r.json();
        if (!stop && j?.run) setRun((prev) => ({ ...prev, ...j.run }));
      } catch { /* keep polling */ }
    };
    tick();
    const t = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [live, run.id]);

  // one line per document: action row wins over its RECEIVED row
  const docs = useMemo(() => {
    const byDoc = new Map<string, LiveEvent & { received?: LiveEvent }>();
    for (const e of events) {
      const key = `${e.county}|${e.doc_number}`;
      const cur = byDoc.get(key);
      if (e.outcome === "RECEIVED") { if (!cur) byDoc.set(key, { ...e, received: e }); else cur.received = e; }
      else byDoc.set(key, { ...e, received: cur?.received ?? (cur?.outcome === "RECEIVED" ? cur : undefined) });
    }
    return [...byDoc.values()].reverse();
  }, [events]);

  const received = events.filter((e) => e.outcome === "RECEIVED").length;
  const newFc = events.filter((e) => e.outcome === "New foreclosure row").length;
  const joined = events.filter((e) => (e.outcome ?? "").startsWith("Joined")).length;
  const cancelled = events.filter((e) => e.outcome === "Cancellation recorded").length;
  const review = events.filter((e) => /NEEDS REVIEW/i.test(e.note ?? "")).length;

  const endMs = run.ended_at ? new Date(run.ended_at).getTime() : now;
  const elapsedMs = endMs === null ? null : endMs - new Date(run.started_at).getTime();
  const elapsed = elapsedMs === null ? "0:00"
    : `${Math.max(0, Math.floor(elapsedMs / 60000))}:${String(Math.max(0, Math.floor((elapsedMs % 60000) / 1000))).padStart(2, "0")}`;

  const statusChip = run.status === "success" ? { cls: "chip-joined", label: "Finished" }
    : run.status === "warning" ? { cls: "chip-new", label: "Finished with warnings" }
    : run.status === "error" ? { cls: "chip-review", label: "Stopped" }
    : { cls: "chip-cancel", label: run.status === "queued" ? "Starting" : "Running" };

  return (
    <>
      <PageHeader
        eyebrow={`Live run · ${run.county === "ALL" ? "All counties" : shortCounty(run.county)}`}
        title={fmtDateTime(run.started_at)}
        line={live ? "Documents land here the moment the reader finishes each one." : `Done in ${elapsed}.`}
        actions={<div className="flex items-center gap-3"><Chip cls={statusChip.cls} label={statusChip.label} /><Link href="/" className="btn btn-ghost">Console</Link></div>}
      />

      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <Stat label={live ? "Elapsed" : "Took"} value={elapsed} />
        <Stat label="Received" value={received} />
        <Stat label="New foreclosures" value={newFc} />
        <Stat label="Joined" value={joined} />
        <Stat label="Cancellations" value={cancelled} />
        <Stat label="Needs review" value={review} tone={review > 0 ? "alert" : "default"} />
      </section>

      {live && (
        <div className="flex items-center gap-3 text-sm text-gray mb-4" role="status" aria-live="polite">
          <span className="inline-block w-2 h-2 rounded-full bg-bronze animate-pulse" />
          {received === 0 ? "Waiting for the first document" : `Sorting documents as they come in`}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="card p-10 text-center text-gray">{live ? "Nothing yet. The first document usually appears within a minute." : "No documents were processed in this run."}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Time</th><th>Document</th><th>County</th><th>Type</th><th>Property</th><th>Outcome</th></tr></thead>
            <tbody>
              {docs.map((d) => {
                const chip = outcomeChip(d.outcome === "RECEIVED" ? null : d.outcome, d.note);
                const addr = cleanAddress(d.received?.address ?? d.address);
                return (
                  <tr key={`${d.county}|${d.doc_number}|${d.id}`}>
                    <td className="whitespace-nowrap text-gray">{fmtTime(d.ts)}</td>
                    <td><PdfLink url={d.pdf_url ?? d.received?.pdf_url ?? null} label={d.doc_number ?? ""} /></td>
                    <td className="whitespace-nowrap">{shortCounty(d.county)}</td>
                    <td className="whitespace-nowrap">{d.received?.doc_type ?? d.doc_type}</td>
                    <td className="prop">{addr || <span className="text-gray">No address read</span>}</td>
                    <td><Chip cls={chip.cls} label={d.outcome === "RECEIVED" ? "Reading" : chip.label} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!live && (
        <p className="text-sm text-gray mt-6">
          Everything above is on the sheet. <Link className="link" href="/review">Open the review queue</Link> or <Link className="link" href="/documents">search the archive</Link>.
        </p>
      )}
    </>
  );
}

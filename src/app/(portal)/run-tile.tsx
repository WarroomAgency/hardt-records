"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { shortCounty } from "@/lib/format";

export type QueueCounts = { foreclosure?: number; cancellation?: number; code_violation?: number; cv_cancellation?: number };

const LABELS: Record<keyof QueueCounts, string> = {
  foreclosure: "foreclosure", cancellation: "cancellation", code_violation: "code violation", cv_cancellation: "CV cancellation",
};
const SOFT_LIMIT = 150;

export function RunTile({ county, lastRunLabel, lastRunSummary, lastRunHref, queued, queueError }: {
  county: string; lastRunLabel: string; lastRunSummary: string; lastRunHref?: string;
  queued?: QueueCounts | null; queueError?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const parts = queued ? (Object.keys(LABELS) as (keyof QueueCounts)[]).filter((k) => (queued[k] ?? 0) > 0) : [];
  const total = queued ? parts.reduce((n, k) => n + (queued[k] ?? 0), 0) : null;
  const oversize = (total ?? 0) > SOFT_LIMIT;

  async function run() {
    if (oversize && !confirm(`${total} files are waiting in ${shortCounty(county)}. Large pulls can time out; run anyway?`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ county }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.run_id) { router.push(`/runs/live/${j.run_id}`); return; }
      if (r.status === 409 && j.run_id) { setMsg(j.message ?? "A run is already in progress."); return; }
      setMsg(j.message ?? (r.ok ? "Run started." : "Could not start the run."));
    } catch {
      setMsg("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">County</div>
          <div className="text-xl font-display font-extrabold mt-1" style={{ fontFamily: "var(--font-display)" }}>{shortCounty(county)}</div>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy} aria-label={`Run ${shortCounty(county)}`}>
          {busy ? "Starting" : "Run"}
        </button>
      </div>

      <div className="text-sm">
        {queueError ? (
          <span className="text-gray">Queue count unavailable</span>
        ) : total === null ? (
          <span className="text-gray">Checking the folders</span>
        ) : total === 0 ? (
          <span className="text-gray">Nothing waiting in the folders</span>
        ) : (
          <span className={oversize ? "text-alert" : ""}>
            <span className="font-display font-extrabold tabular" style={{ fontFamily: "var(--font-display)" }}>{total}</span>{" "}
            {total === 1 ? "file" : "files"} waiting
            <span className="text-gray"> · {parts.map((k) => `${queued![k]} ${LABELS[k]}`).join(", ")}</span>
          </span>
        )}
      </div>

      <div className="text-sm text-gray border-t hairline pt-3">
        {lastRunHref ? <Link href={lastRunHref} className="link">{lastRunLabel}</Link> : lastRunLabel}
        {lastRunSummary && <div className="mt-0.5">{lastRunSummary}</div>}
      </div>
      {msg && <div className="text-sm" role="status">{msg}</div>}
    </div>
  );
}

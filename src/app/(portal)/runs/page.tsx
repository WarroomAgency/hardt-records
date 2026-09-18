import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Pager } from "@/components/ui";
import { durationLabel, fmtDateTime, shortCounty } from "@/lib/format";

const PAGE = 25;

export default async function RunsPage(props: { searchParams: Promise<{ page?: string }> }) {
  const { page: p } = await props.searchParams;
  const page = Math.max(1, parseInt(p ?? "1", 10) || 1);
  const supabase = await createClient();
  const from = (page - 1) * PAGE;

  const { data, count } = await supabase
    .from("run_sessions")
    .select("*", { count: "exact" })
    .order("started_at", { ascending: false })
    .range(from, from + PAGE - 1);

  const rows = (data ?? []) as {
    id: number; started_at: string; ended_at: string; counties: string[];
    docs_received: number; new_foreclosures: number; nts_joins: number; cancellations: number; code_violations: number; needs_review: number;
  }[];

  return (
    <>
      <PageHeader eyebrow="History" title="Runs" line="Each row is one pull through the system, newest first." />
      {rows.length === 0 ? (
        <Empty title="No runs yet" body="Once a county is run, it shows up here with its counts." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Started</th><th>Counties</th><th>Length</th>
                <th className="text-right">Received</th><th className="text-right">New</th><th className="text-right">Joined</th>
                <th className="text-right">Cancelled</th><th className="text-right">Review</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(r.started_at)}</td>
                  <td>{(r.counties ?? []).map(shortCounty).join(", ")}</td>
                  <td className="whitespace-nowrap text-gray">{durationLabel(r.started_at, r.ended_at)}</td>
                  <td className="text-right tabular">{r.docs_received}</td>
                  <td className="text-right tabular">{r.new_foreclosures}</td>
                  <td className="text-right tabular">{r.nts_joins}</td>
                  <td className="text-right tabular">{r.cancellations}</td>
                  <td className={`text-right tabular ${r.needs_review > 0 ? "text-alert" : "text-gray"}`}>{r.needs_review}</td>
                  <td className="text-right"><Link className="link" href={`/runs/${r.id}`}>Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(n) => `/runs?page=${n}`} />
    </>
  );
}

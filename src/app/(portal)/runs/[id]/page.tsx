import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Chip, PageHeader, PdfLink, Stat } from "@/components/ui";
import { cleanAddress, durationLabel, fmtDateTime, fmtTime, outcomeChip, shortCounty } from "@/lib/format";

type Ev = { id: number; ts: string; county: string | null; doc_type: string | null; doc_number: string | null; pdf_url: string | null; address: string | null; outcome: string | null; note: string | null };

export default async function RunDetail(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: s } = await supabase.from("run_sessions").select("*").eq("id", Number(id)).maybeSingle();
  if (!s) notFound();

  const { data } = await supabase
    .from("events").select("*")
    .gte("ts", s.started_at).lte("ts", s.ended_at)
    .order("ts", { ascending: true }).order("id", { ascending: true });
  const events = (data ?? []) as Ev[];

  // one line per document: prefer the action row over the RECEIVED row
  const byDoc = new Map<string, Ev & { received?: Ev }>();
  for (const e of events) {
    const key = `${e.county}|${e.doc_number}`;
    const cur = byDoc.get(key);
    if (e.outcome === "RECEIVED") {
      if (!cur) byDoc.set(key, { ...e, received: e }); else cur.received = e;
    } else {
      byDoc.set(key, { ...e, received: cur?.received ?? (cur?.outcome === "RECEIVED" ? cur : undefined) });
    }
  }
  const docs = [...byDoc.values()];
  const groups: Record<string, (Ev & { received?: Ev })[]> = {};
  for (const d of docs) (groups[d.county ?? "Unknown"] ??= []).push(d);

  return (
    <>
      <PageHeader
        eyebrow={`Run · ${(s.counties ?? []).map(shortCounty).join(" + ")}`}
        title={fmtDateTime(s.started_at)}
        line={`${fmtTime(s.started_at)} to ${fmtTime(s.ended_at)}, ${durationLabel(s.started_at, s.ended_at)}.`}
        actions={<Link href="/runs" className="btn btn-ghost">All runs</Link>}
      />

      <section className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        <Stat label="Received" value={s.docs_received} />
        <Stat label="New foreclosures" value={s.new_foreclosures} />
        <Stat label="Joined to existing" value={s.nts_joins} />
        <Stat label="Cancellations" value={s.cancellations} />
        <Stat label="Needs review" value={s.needs_review} tone={s.needs_review > 0 ? "alert" : "default"} />
      </section>

      {Object.entries(groups).map(([county, list]) => (
        <section key={county} className="mb-10">
          <h2 className="text-xl mb-3">{shortCounty(county)} <span className="text-gray font-normal text-base">· {list.length} documents</span></h2>
          <div className="card overflow-x-auto">
            <table className="data">
              <thead><tr><th>Time</th><th>Document</th><th>Type</th><th>Property</th><th>Outcome</th><th>Note</th></tr></thead>
              <tbody>
                {list.map((d) => {
                  const chip = outcomeChip(d.outcome === "RECEIVED" ? null : d.outcome, d.note);
                  const addr = cleanAddress(d.received?.address ?? d.address);
                  return (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap text-gray">{fmtTime(d.ts)}</td>
                      <td><PdfLink url={d.pdf_url ?? d.received?.pdf_url ?? null} label={d.doc_number ?? ""} /></td>
                      <td className="whitespace-nowrap">{d.received?.doc_type ?? d.doc_type}</td>
                      <td className="prop">{addr || <span className="text-gray">No address read</span>}</td>
                      <td><Chip cls={chip.cls} label={chip.label} /></td>
                      <td className="text-gray text-sm">{d.note && !/NEEDS REVIEW/i.test(d.note) ? d.note : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}

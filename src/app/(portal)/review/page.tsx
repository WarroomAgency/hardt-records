import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Pager, PdfLink } from "@/components/ui";
import { cleanAddress, fmtDate, shortCounty } from "@/lib/format";

const PAGE = 50;

export default async function ReviewPage(props: { searchParams: Promise<{ page?: string }> }) {
  const { page: p } = await props.searchParams;
  const page = Math.max(1, parseInt(p ?? "1", 10) || 1);
  const from = (page - 1) * PAGE;
  const supabase = await createClient();

  const { data, count } = await supabase
    .from("documents").select("*", { count: "exact" })
    .eq("needs_review", true)
    .order("last_seen", { ascending: false })
    .range(from, from + PAGE - 1);

  const rows = (data ?? []) as { county: string; doc_number: string; doc_type: string | null; pdf_url: string | null; address: string | null; last_seen: string; last_outcome: string | null }[];

  return (
    <>
      <PageHeader
        eyebrow="Attention"
        title="Needs review"
        line="Documents the reader could not fully trust, usually a cut-off address or a hard-to-read stamp."
      />
      {rows.length === 0 ? (
        <Empty title="Nothing waiting" body="Every document read cleanly." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Document</th><th>County</th><th>Type</th><th>Property</th><th>What happened</th><th>Flagged</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={`${d.county}|${d.doc_number}`}>
                  <td><PdfLink url={d.pdf_url} label={d.doc_number} /></td>
                  <td className="whitespace-nowrap">{shortCounty(d.county)}</td>
                  <td className="whitespace-nowrap">{d.doc_type}</td>
                  <td className="prop">{cleanAddress(d.address) || <span className="text-alert">Address did not read</span>}</td>
                  <td className="text-gray whitespace-nowrap">{d.last_outcome === "RECEIVED" ? "Received, not written" : d.last_outcome}</td>
                  <td className="whitespace-nowrap text-gray">{fmtDate(d.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE} total={count ?? 0} hrefFor={(n) => `/review?page=${n}`} />
    </>
  );
}

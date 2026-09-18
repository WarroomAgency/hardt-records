import { createClient } from "@/lib/supabase/server";
import { Chip, Empty, PageHeader, Pager, PdfLink } from "@/components/ui";
import { COUNTIES, cleanAddress, docStatus, fmtDate, shortCounty } from "@/lib/format";

const PAGE = 50;
type Doc = { county: string; doc_number: string; doc_type: string | null; pdf_url: string | null; address: string | null; first_seen: string; last_seen: string; last_outcome: string | null; needs_review: boolean; skipped: boolean };

export default async function DocumentsPage(props: { searchParams: Promise<{ q?: string; county?: string; status?: string; page?: string }> }) {
  const sp = await props.searchParams;
  const q = (sp.q ?? "").trim().replace(/[,()%]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  const county = sp.county ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE;

  const supabase = await createClient();
  let query = supabase.from("documents").select("*", { count: "exact" });
  if (county) query = query.eq("county", county);
  if (status === "review") query = query.eq("needs_review", true);
  else if (status === "new") query = query.eq("last_outcome", "New foreclosure row");
  else if (status === "cancel") query = query.eq("last_outcome", "Cancellation recorded");
  else if (status === "joined") query = query.ilike("last_outcome", "Joined%");
  else if (status === "skipped") query = query.eq("skipped", true);
  if (q) query = query.or(`doc_number.ilike.%${q}%,address.ilike.%${q}%`);

  const { data, count } = await query.order("last_seen", { ascending: false }).range(from, from + PAGE - 1);
  const rows = (data ?? []) as Doc[];

  const href = (n: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q); if (county) u.set("county", county); if (status) u.set("status", status);
    u.set("page", String(n));
    return `/documents?${u.toString()}`;
  };

  return (
    <>
      <PageHeader eyebrow="Archive" title="Documents" line="Every notice the system has read, with the recorded PDF one click away." />

      <form className="card p-4 mb-5 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]" method="get">
        <input className="input" name="q" placeholder="Search doc number or address" defaultValue={q} aria-label="Search" />
        <select className="input" name="county" defaultValue={county} aria-label="County">
          <option value="">All counties</option>
          {COUNTIES.map((c) => <option key={c} value={c}>{shortCounty(c)}</option>)}
        </select>
        <select className="input" name="status" defaultValue={status} aria-label="Status">
          <option value="">Any status</option>
          <option value="new">New foreclosure</option>
          <option value="joined">Joined to existing</option>
          <option value="cancel">Cancellation</option>
          <option value="review">Needs review</option>
          <option value="skipped">Skipped</option>
        </select>
        <button className="btn btn-primary">Filter</button>
      </form>

      {rows.length === 0 ? (
        <Empty title="Nothing matches" body="Try a shorter search or clear the filters." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Document</th><th>County</th><th>Type</th><th>Property</th><th>Status</th><th>Last seen</th></tr></thead>
            <tbody>
              {rows.map((d) => {
                const st = docStatus(d);
                return (
                  <tr key={`${d.county}|${d.doc_number}`}>
                    <td><PdfLink url={d.pdf_url} label={d.doc_number} /></td>
                    <td className="whitespace-nowrap">{shortCounty(d.county)}</td>
                    <td className="whitespace-nowrap">{d.doc_type}</td>
                    <td className="prop">{cleanAddress(d.address) || <span className="text-gray">No address read</span>}</td>
                    <td><Chip cls={st.cls} label={st.label} /></td>
                    <td className="whitespace-nowrap text-gray">{fmtDate(d.last_seen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pageSize={PAGE} total={count ?? 0} hrefFor={href} />
    </>
  );
}

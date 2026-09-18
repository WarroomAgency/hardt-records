import Link from "next/link";

export function PageHeader({ eyebrow, title, line, actions }: {
  eyebrow: string; title: string; line?: string; actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6 mb-6 border-b hairline">
      <div>
        <div className="eyebrow mb-2">{eyebrow}</div>
        <h1 className="text-3xl md:text-4xl">{title}</h1>
        {line && <p className="serif-line mt-2">{line}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, sub, tone }: {
  label: string; value: string | number; sub?: string; tone?: "default" | "alert";
}) {
  return (
    <div className="card p-5">
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 text-3xl font-display font-extrabold tabular ${tone === "alert" ? "text-alert" : ""}`}
           style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-sm text-gray">{sub}</div>}
    </div>
  );
}

export function Chip({ cls, label }: { cls: string; label: string }) {
  return <span className={`chip ${cls}`}>{label}</span>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="font-display font-extrabold text-lg" style={{ fontFamily: "var(--font-display)" }}>{title}</div>
      {body && <p className="text-gray mt-2 max-w-md mx-auto">{body}</p>}
    </div>
  );
}

export function PdfLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="tabular">{label}</span>;
  return (
    <a className="link tabular" href={url} target="_blank" rel="noopener noreferrer" title="Open the recorded document">
      {label}
    </a>
  );
}

export function Pager({ page, pageSize, total, hrefFor }: {
  page: number; pageSize: number; total: number; hrefFor: (p: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between mt-4 text-sm" aria-label="Pagination">
      <span className="text-gray">Page {page} of {pages} · {total.toLocaleString()} results</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn btn-ghost" href={hrefFor(page - 1)}>Previous</Link>}
        {page < pages && <Link className="btn btn-ghost" href={hrefFor(page + 1)}>Next</Link>}
      </div>
    </nav>
  );
}

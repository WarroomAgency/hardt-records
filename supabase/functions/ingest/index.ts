// ingest — shared entry point for (a) the one-time Run Log backfill and
// (b) live per-doc event pushes from the Make PROD scenario (http modules 401–410).
// Auth: shared secret (x-ingest-secret header or body.secret) checked against
// app_config.ingest_secret. Deployed with verify_jwt OFF.
// Body: { source: "backfill"|"live", run_id?: uuid,
//         rows: [[raw_ts, county, doc_type, doc_cell, address, outcome, note], ...] }
// doc_cell may be the raw formula =HYPERLINK("url","doc#") or a plain doc#.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const HYPER = /=HYPERLINK\(\s*"([^"]*)"\s*[,;]\s*"([^"]*)"\s*\)/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseDoc(cell: unknown): { doc: string; url: string | null } {
  const s = (cell ?? "").toString().trim();
  const m = s.match(HYPER);
  if (m) return { url: m[1] || null, doc: (m[2] || "").trim() };
  return { doc: s, url: null };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

  const provided = req.headers.get("x-ingest-secret") ?? body?.secret ?? "";
  const { data: cfg } = await supabase.from("app_config").select("value").eq("key", "ingest_secret").single();
  if (!cfg || !provided || provided !== cfg.value) {
    return new Response("unauthorized", { status: 401 });
  }

  const source = body.source === "backfill" ? "backfill" : "live";
  // Make sends "{{400.run_id}}" which is empty on manual runs; only accept a real uuid
  const run_id = typeof body.run_id === "string" && UUID.test(body.run_id.trim()) ? body.run_id.trim() : null;
  const rows: unknown[][] = Array.isArray(body.rows) ? body.rows : [];

  const recs = rows
    .filter((r) => Array.isArray(r) && r.some((c) => (c ?? "").toString().trim() !== ""))
    .map((r) => {
      const [raw_ts, county, doc_type, doc_cell, address, outcome, note] = r;
      const { doc, url } = parseDoc(doc_cell);
      return {
        raw_ts: (raw_ts ?? "").toString().trim() || null,
        county: (county ?? "").toString().trim() || null,
        doc_type: (doc_type ?? "").toString().trim() || null,
        doc_number: doc || null,
        pdf_url: url,
        address: (address ?? "").toString().trim() || null,
        outcome: (outcome ?? "").toString().trim() || null,
        note: (note ?? "").toString().trim() || null,
        run_id,
        source,
      };
    });

  let inserted = 0;
  const CHUNK = 500;
  for (let i = 0; i < recs.length; i += CHUNK) {
    const { error, count } = await supabase
      .from("events")
      .insert(recs.slice(i, i + CHUNK), { count: "exact" });
    if (error) {
      return new Response(JSON.stringify({ ok: false, inserted, error: error.message }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }
    inserted += count ?? 0;
  }

  return new Response(JSON.stringify({ ok: true, received: rows.length, inserted }), {
    headers: { "Content-Type": "application/json" },
  });
});

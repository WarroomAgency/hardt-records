import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Polling fallback for the live run page when the Realtime socket is blocked client-side.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const run_id = url.searchParams.get("run_id") ?? "";
  const after = Number(url.searchParams.get("after") ?? "0") || 0;
  if (!/^[0-9a-f-]{36}$/i.test(run_id)) return NextResponse.json({ ok: false, events: [] }, { status: 400 });

  const supabase = await createClient(); // RLS: allowlisted users only
  const { data, error } = await supabase
    .from("events")
    .select("id, ts, county, doc_type, doc_number, pdf_url, address, outcome, note")
    .eq("run_id", run_id)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(500);
  if (error) return NextResponse.json({ ok: false, events: [] }, { status: 500 });
  return NextResponse.json({ ok: true, events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

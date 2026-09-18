import { NextResponse } from "next/server";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

// Deployment self-check. Reports only shapes and reachability — never secret values.
export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  let fetchStatus: number | null = null;
  let fetchError: string | null = null;
  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_ANON_KEY }, cache: "no-store" });
    fetchStatus = r.status;
  } catch (e) {
    fetchError = e instanceof Error ? `${e.name}: ${e.message}${(e as { cause?: { code?: string } }).cause?.code ? ` (${(e as { cause?: { code?: string } }).cause?.code})` : ""}` : String(e);
  }
  return NextResponse.json({
    url: { present: !!rawUrl, rawLen: rawUrl.length, trimmedLen: SUPABASE_URL.length, hasWhitespace: /\s/.test(rawUrl), host: SUPABASE_URL.replace(/^https?:\/\//, "").slice(0, 40) },
    key: { present: !!rawKey, rawLen: rawKey.length, trimmedLen: SUPABASE_ANON_KEY.length, hasWhitespace: /\s/.test(rawKey), prefix: SUPABASE_ANON_KEY.slice(0, 15) },
    supabaseReachable: { status: fetchStatus, error: fetchError, ms: Date.now() - t0 },
    runtime: { node: process.version, region: process.env.AWS_REGION ?? null },
  }, { headers: { "Cache-Control": "no-store" } });
}

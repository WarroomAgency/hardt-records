import { createClient } from "@/lib/supabase/server";

/** Call a Supabase Edge Function as the signed-in user (server-side; forwards the session token). */
export async function callFunction(name: string, body: unknown = {}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { status: 401, json: { ok: false, message: "Not signed in." } as Record<string, unknown> };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({ ok: false, message: "Bad response from the server." }))) as Record<string, unknown>;
    return { status: res.status, json };
  } catch {
    return { status: 502, json: { ok: false, message: "Could not reach the server." } as Record<string, unknown> };
  }
}

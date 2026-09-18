// Shared helpers for HARDT Records edge functions (copied into each function at deploy time).
import { createClient } from "jsr:@supabase/supabase-js@2";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

export function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Resolve the calling user from the Authorization header and require an allowlisted email. */
export async function requireAllowed(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user?.email) return { user: null, role: null as string | null };
  const { data } = await admin().from("allowed_users").select("role").ilike("email", user.email).maybeSingle();
  return { user: data ? user : null, role: data?.role ?? null };
}

export async function config(keys: string[]) {
  const { data } = await admin().from("app_config").select("key, value").in("key", keys);
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.key] = r.value;
  return out;
}

export async function makeApi(path: string, init: RequestInit, cfg: Record<string, string>) {
  const base = cfg.make_api_base ?? "https://us2.make.com/api/v2";
  const res = await fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Make sits behind Cloudflare, which 403s non-browser user agents (error 1010)
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      Authorization: `Token ${cfg.make_api_token}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

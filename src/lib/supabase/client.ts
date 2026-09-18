"use client";
import { createBrowserClient } from "@supabase/ssr";
import { COOKIE_NAME } from "./cookie";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

/** Auth/session client. Talks to Supabase through this site's own origin (/supabase/*). */
export function createClient() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return createBrowserClient(`${origin}/supabase`, SUPABASE_ANON_KEY, { cookieOptions: { name: COOKIE_NAME } });
}

/** Direct client used only for the Realtime socket (rewrites can't carry WebSockets). */
export function createRealtimeClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, { cookieOptions: { name: COOKIE_NAME } });
}

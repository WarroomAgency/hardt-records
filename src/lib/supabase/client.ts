"use client";
import { createBrowserClient } from "@supabase/ssr";
import { COOKIE_NAME } from "./cookie";

const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Auth/session client. Talks to Supabase through this site's own origin (/supabase/*). */
export function createClient() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return createBrowserClient(`${origin}/supabase`, KEY, { cookieOptions: { name: COOKIE_NAME } });
}

/** Direct client used only for the Realtime socket (rewrites can't carry WebSockets). */
export function createRealtimeClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY, { cookieOptions: { name: COOKIE_NAME } });
}

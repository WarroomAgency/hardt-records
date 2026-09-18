// Single source for public Supabase config. Trimmed defensively: a stray space or newline
// pasted into a hosting dashboard silently breaks every server-side URL.
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

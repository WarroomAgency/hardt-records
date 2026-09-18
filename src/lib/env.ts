// Single source for public Supabase config, hardened against dashboard paste errors
// (whitespace, trailing slashes, or another variable's line glued onto the value).
const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const origin = rawUrl.match(/^https?:\/\/[a-z0-9.-]+\.supabase\.(?:co|in)/i)?.[0];

export const SUPABASE_URL = (origin ?? rawUrl).replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim().split(/\s/)[0];

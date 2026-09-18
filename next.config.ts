import type { NextConfig } from "next";

// Browser-side Supabase calls go through our own origin (/supabase/*) so ad/privacy
// blockers that refuse third-party API hosts cannot break sign-in.
const rawUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_URL = (rawUrl.match(/^https?:\/\/[a-z0-9.-]+\.supabase\.(?:co|in)/i)?.[0] ?? rawUrl).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!SUPABASE_URL) return [];
    return [{ source: "/supabase/:path*", destination: `${SUPABASE_URL}/:path*` }];
  },
};

export default nextConfig;

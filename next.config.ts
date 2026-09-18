import type { NextConfig } from "next";

// Browser-side Supabase calls go through our own origin (/supabase/*) so ad/privacy
// blockers that refuse third-party API hosts cannot break sign-in.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

const nextConfig: NextConfig = {
  async rewrites() {
    if (!SUPABASE_URL) return [];
    return [{ source: "/supabase/:path*", destination: `${SUPABASE_URL}/:path*` }];
  },
};

export default nextConfig;

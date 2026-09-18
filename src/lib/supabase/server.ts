import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "./cookie";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookieOptions: { name: COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component: the proxy refreshes sessions, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** Current user + whether their email is on the allowlist (RLS hides the row otherwise). */
export async function getViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, allowed: false, role: null as string | null };
  const { data } = await supabase
    .from("allowed_users")
    .select("role")
    .ilike("email", user.email ?? "")
    .maybeSingle();
  return { supabase, user, allowed: !!data, role: data?.role ?? null };
}

"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ITEMS = [
  { href: "/", label: "Run console" },
  { href: "/runs", label: "Runs" },
  { href: "/documents", label: "Documents" },
  { href: "/review", label: "Needs review" },
];

export function Nav({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const items = isAdmin ? [...ITEMS, { href: "/admin", label: "Team access" }] : ITEMS;

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="bg-charcoal text-cream md:w-60 md:min-h-screen flex md:flex-col">
      <div className="px-5 py-5 border-b hairline-dark flex items-center justify-between md:block">
        <div>
          <div className="font-display font-extrabold tracking-tight text-lg" style={{ fontFamily: "var(--font-display)" }}>
            HARDT
          </div>
          <div className="eyebrow eyebrow-on-dark mt-1">County records</div>
        </div>
      </div>
      <nav className="flex md:flex-col overflow-x-auto md:overflow-visible px-2 py-2 md:py-4 gap-1 flex-1" aria-label="Main">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`px-3 py-2 rounded-brand text-sm font-display font-extrabold tracking-wide whitespace-nowrap ${
                active ? "bg-cream text-charcoal" : "text-cream/80 hover:text-cream hover:bg-white/5"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4 border-t hairline-dark hidden md:block">
        <div className="text-xs text-cream/60 truncate" title={email}>{email}</div>
        <button onClick={signOut} className="mt-2 text-xs underline underline-offset-4 text-cream/80 hover:text-cream">
          Sign out
        </button>
      </div>
    </aside>
  );
}

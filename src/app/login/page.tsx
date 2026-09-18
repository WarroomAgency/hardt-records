"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const res = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    if (mode === "create" && !res.data.session) {
      setError("This email is not on the team list yet. Ask Peter or Michael to add it, then try again.");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  return (
    <main className="flex-1 grid md:grid-cols-[1.1fr_1fr] min-h-screen">
      <section className="bg-charcoal text-cream p-8 md:p-14 flex flex-col justify-between">
        <div>
          <div className="font-display font-extrabold text-2xl tracking-tight" style={{ fontFamily: "var(--font-display)" }}>HARDT</div>
          <div className="eyebrow eyebrow-on-dark mt-1">County records</div>
        </div>
        <div>
          <h1 className="text-4xl md:text-5xl max-w-md">Every notice, sorted, the same day it is recorded.</h1>
          <p className="serif-line mt-4 text-cream/70">Run a pull, watch it land, and know what needs a second look.</p>
        </div>
        <div className="text-xs text-cream/50">Private. For the HARDT team only.</div>
      </section>

      <section className="p-8 md:p-14 flex items-center">
        <form onSubmit={submit} className="w-full max-w-sm mx-auto">
          <div className="eyebrow">{mode === "signin" ? "Sign in" : "Create your account"}</div>
          <h2 className="text-2xl mt-2 mb-6">{mode === "signin" ? "Welcome back" : "First time here"}</h2>

          <label className="block text-sm mb-1" htmlFor="email">Email</label>
          <input id="email" className="input mb-4" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />

          <label className="block text-sm mb-1" htmlFor="password">Password</label>
          <input id="password" className="input mb-5" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />

          {error && <p className="text-sm text-alert mb-4" role="alert">{error}</p>}

          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "One moment" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <p className="text-sm text-gray mt-5">
            {mode === "signin" ? (
              <>New to the portal? <button type="button" className="link" onClick={() => setMode("create")}>Create your account</button></>
            ) : (
              <>Already set up? <button type="button" className="link" onClick={() => setMode("signin")}>Sign in</button></>
            )}
          </p>
          <p className="text-xs text-gray mt-6">Accounts work only for emails on the team list.</p>
        </form>
      </section>
    </main>
  );
}

// queue — how many files are waiting in each county folder (via a Make webhook that uses the existing Drive connection).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS, json, requireAllowed, config } from "../_shared.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const { user } = await requireAllowed(req);
  if (!user) return json({ ok: false, message: "Not authorized." }, 401);

  const cfg = await config(["queue_webhook_url"]);
  if (!cfg.queue_webhook_url) return json({ ok: false, message: "Queue counts not connected yet." }, 503);

  try {
    const r = await fetch(cfg.queue_webhook_url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const text = await r.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!r.ok || !data) return json({ ok: false, message: "Queue counts unavailable right now." }, 502);
    return json({ ok: true, counts: data, checked_at: new Date().toISOString() });
  } catch {
    return json({ ok: false, message: "Queue counts unavailable right now." }, 502);
  }
});

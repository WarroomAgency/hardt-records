# HARDT Records

Self-serve portal for the HARDT county-records automation: run a county pull, watch documents land live, browse runs and the full document archive, and manage who can sign in.

- **App:** Next.js 16 (App Router) + Tailwind 4, brand tokens from the HARDT site (self-hosted fonts in `public/fonts`).
- **Backend:** Supabase project `hardt-records` (`ygcdduigwmejozdggdao`) — Postgres + Realtime + Edge Functions + Auth.
- **Automation:** Make scenario 5374440 (PROD). It pushes every processed document to the `ingest` function; the portal triggers it through the `run` function.

## Local development

```bash
npm install
npm run dev -- --port 4336
```

`.env.local` (not committed):

```
NEXT_PUBLIC_SUPABASE_URL=https://ygcdduigwmejozdggdao.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable key from Supabase → Project Settings → API>
```

Only the publishable key ever reaches the browser. Row Level Security limits reads to emails on the `allowed_users` table; writes happen only inside edge functions with the service role.

## How sign-in works

Email + password. Accounts confirm instantly **only** if the email is on `allowed_users` (a trigger on `auth.users`); anyone else stays unconfirmed and cannot sign in. Add people on the **Team access** page (admins only).

## How a run works

1. Run console → **Run** on a county → `/api/run` → edge function `run`.
2. `run` inserts a `runs` row, writes `{county, run_id}` to the Make data store `run_control` (153055), then starts scenario 5374440 via the Make API.
3. PROD reads `run_control` first; a link filter processes only the requested county (or everything when `county = ALL`).
4. After each Run Log append, PROD posts the same row to `ingest` with the `run_id`; the live page subscribes to those inserts over Realtime.
5. The live page polls `/api/run-status` every 8 s; `run-status` closes the run from Make's execution log and resets `run_control` to `ALL`.

Queue counts on the console come from Make webhook scenario 6326460 (counts PDFs per source folder with the existing Drive connection).

## Supabase config (`app_config` table, service role only)

| key | value |
|---|---|
| `ingest_secret` | shared secret checked by `ingest` (also embedded in PROD's http modules) |
| `queue_webhook_url` | Make webhook for folder counts |
| `make_api_base` | `https://us2.make.com/api/v2` |
| `make_scenario_id` | `5374440` |
| `make_datastore_id` | `153055` |
| `make_datastructure_id` | `502486` |
| `make_api_token` | **required for triggering** — Make → profile → API Access → generate (scopes: scenarios read/write, data stores). Insert it here; no redeploy needed. |

Make's API is behind Cloudflare and rejects non-browser user agents with `403 error code: 1010`; the shared `makeApi()` helper in the edge functions sends a Chrome user agent for that reason. Keep it if you ever rewrite the helper.

Edge function sources are deployed from Supabase; local copies live outside this repo (see the project memory) — redeploy via the Supabase MCP or CLI if they need changes.

## Deploy (Netlify)

1. Create a GitHub repo (WarroomAgency org) and push `main`.
2. Netlify → Add new site → import the repo. Build command `npm run build` (Next.js runtime is auto-detected).
3. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Custom domain: `hardtautomation.warroomagency.com` → add a CNAME for `hardtautomation` pointing at the Netlify site name (`<site>.netlify.app`) in the warroomagency.com DNS (NS1 / GoHighLevel panel), then let Netlify issue the certificate.
5. Optional hygiene (password sign-in does not redirect): Supabase → Authentication → URL Configuration → Site URL `https://hardtautomation.warroomagency.com`.
6. Sign in with an allowlisted email, then add Peter's team on **Team access**.

## Operational notes

- The run console refuses a second run while one is queued/running (under 60 min old).
- Very large queues (150+ files in one county) prompt for confirmation; the automation's own timeout is ~45 min at roughly 10–12 s per document.
- Times display in Pacific; storage is UTC; Make's own clock is Eastern (already handled in the DB trigger).
- Runs and document history before the portal existed are derived from the Run Log backfill (`run_sessions` view, 15-minute gap clustering).

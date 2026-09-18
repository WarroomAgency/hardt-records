-- HARDT Records portal — core schema
-- Source of truth for landing data stays in the Google Sheet; this DB holds the
-- event feed (Run Log), run metadata, and portal auth/allowlist.

create extension if not exists pgcrypto;

-- ---------- app config (service-role only) ----------
create table if not exists app_config (
  key   text primary key,
  value text not null
);

-- ---------- invite-only allowlist ----------
create table if not exists allowed_users (
  email      text primary key,
  role       text not null default 'member',   -- 'admin' | 'member'
  added_at   timestamptz not null default now()
);

-- ---------- runs ----------
create table if not exists runs (
  id                 uuid primary key default gen_random_uuid(),
  county             text not null,             -- 'Kern County' | ... | 'ALL'
  status             text not null default 'queued', -- queued|running|success|warning|error
  started_at         timestamptz not null default now(),
  ended_at           timestamptz,
  triggered_by       text,                      -- email of the user who clicked Run
  make_execution_id  text,
  doc_count          int not null default 0,
  summary            jsonb
);
create index if not exists runs_started_idx on runs (started_at desc);

-- ---------- events (one row per Run Log line) ----------
create table if not exists events (
  id          bigserial primary key,
  raw_ts      text,                 -- original Run Log text e.g. "9/18/2026 7:52 AM"
  ts          timestamptz,          -- computed from raw_ts (America/Los_Angeles) by trigger
  county      text,
  doc_type    text,                 -- Run Log col C label
  doc_number  text,
  pdf_url     text,                 -- parsed from =HYPERLINK(url, doc#)
  address     text,
  outcome     text,                 -- RECEIVED | New foreclosure row | Joined NTS... | Cancellation recorded | ...
  note        text,
  run_id      uuid references runs(id) on delete set null,
  source      text not null default 'live',  -- 'backfill' | 'live'
  created_at  timestamptz not null default now()
);
create index if not exists events_ts_idx        on events (ts desc);
create index if not exists events_county_idx    on events (county);
create index if not exists events_doc_idx       on events (doc_number);
create index if not exists events_outcome_idx   on events (outcome);
create index if not exists events_run_idx       on events (run_id);

-- parse "M/D/YYYY h:mm AM" (Make formatDate in org tz) into timestamptz
create or replace function events_set_ts() returns trigger
language plpgsql as $$
begin
  if new.ts is null and new.raw_ts is not null and new.raw_ts <> '' then
    begin
      new.ts := (to_timestamp(new.raw_ts, 'FMMM/FMDD/YYYY FMHH12:MI AM')
                 at time zone 'America/Los_Angeles');
    exception when others then
      new.ts := null;
    end;
  end if;
  return new;
end $$;

drop trigger if exists events_set_ts_trg on events;
create trigger events_set_ts_trg
before insert or update of raw_ts on events
for each row execute function events_set_ts();

-- ---------- documents: latest state per doc ----------
create or replace view documents as
with ev as (
  select *,
         row_number() over (partition by county, doc_number order by ts desc nulls last, id desc) as rn
  from events
  where doc_number is not null and doc_number <> ''
)
select
  e.county,
  e.doc_number,
  max(e.doc_type)                                          as doc_type,
  max(e.pdf_url)                                           as pdf_url,
  max(nullif(btrim(e.address, ', '), ''))                  as address,
  min(e.ts)                                                as first_seen,
  max(e.ts)                                                as last_seen,
  (array_agg(e.outcome order by e.ts desc nulls last, e.id desc))[1] as last_outcome,
  array_remove(array_agg(distinct e.outcome), null)        as outcomes,
  bool_or(coalesce(e.note,'') ilike '%NEEDS REVIEW%' or coalesce(e.outcome,'') ilike '%NEEDS REVIEW%') as needs_review,
  bool_or(e.outcome = 'RECEIVED' and not exists (
      select 1 from events x
      where x.county = e.county and x.doc_number = e.doc_number and x.outcome <> 'RECEIVED'))
                                                           as skipped
from events e
where e.doc_number is not null and e.doc_number <> ''
group by e.county, e.doc_number;

-- ---------- RLS ----------
alter table app_config    enable row level security;
alter table allowed_users enable row level security;
alter table runs          enable row level security;
alter table events        enable row level security;

-- helper: is the current JWT email on the allowlist?
create or replace function is_allowed() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- allowlisted authenticated users can read runs/events/allowlist
create policy runs_read    on runs          for select to authenticated using (is_allowed());
create policy events_read  on events        for select to authenticated using (is_allowed());
create policy allow_read   on allowed_users for select to authenticated using (is_allowed());
-- app_config: no policies → service role only.
-- writes: service role only (edge functions).

-- ---------- realtime ----------
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table runs;

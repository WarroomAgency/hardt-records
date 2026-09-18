-- Migrations applied to project ygcdduigwmejozdggdao AFTER schema.sql, in order.
-- The live database is the source of truth; this file documents how it got there.

-- 1) events.ts: decode Google Sheets date serials AND text timestamps; Make's clock is Eastern.
create or replace function events_set_ts() returns trigger
language plpgsql as $$
begin
  if new.ts is null and new.raw_ts is not null and btrim(new.raw_ts) <> '' then
    begin
      if btrim(new.raw_ts) ~ '^[0-9]+(\.[0-9]+)?$' then
        -- Sheets serial (days since 1899-12-30), local to the Make org clock (Eastern)
        new.ts := ((timestamp '1899-12-30' + (btrim(new.raw_ts)::numeric * interval '1 day'))
                   at time zone 'America/New_York');
      else
        -- text "M/D/YYYY h:mm AM" as written by Make formatDate(now) (Eastern)
        new.ts := ((to_timestamp(btrim(new.raw_ts), 'FMMM/FMDD/YYYY FMHH12:MI AM') at time zone 'UTC')
                   at time zone 'America/New_York');
      end if;
    exception when others then
      new.ts := null;
    end;
  end if;
  return new;
end $$;

-- 2) views must run as the querying user so RLS applies
alter view documents set (security_invoker = true);

-- 3) historical run sessions derived from the event feed (new session after a 15-minute gap)
create or replace view run_sessions
with (security_invoker = true) as
with e as (
  select id, ts, county, outcome, note,
         case when lag(ts) over (order by ts, id) is null
                or ts - lag(ts) over (order by ts, id) > interval '15 minutes'
              then 1 else 0 end as brk
  from events
  where ts is not null
), g as (
  select *, sum(brk) over (order by ts, id) as session_no from e
)
select
  session_no                                                     as id,
  min(ts)                                                        as started_at,
  max(ts)                                                        as ended_at,
  array_remove(array_agg(distinct county), null)                 as counties,
  count(*) filter (where outcome = 'RECEIVED')                   as docs_received,
  count(*) filter (where outcome = 'New foreclosure row')        as new_foreclosures,
  count(*) filter (where outcome ilike 'Joined%')                as nts_joins,
  count(*) filter (where outcome = 'Cancellation recorded')      as cancellations,
  count(*) filter (where outcome ilike '%violation%' or outcome ilike '%expunge%') as code_violations,
  count(*) filter (where coalesce(note,'') ilike '%NEEDS REVIEW%') as needs_review
from g
group by session_no;

-- 4) admin helper + admin-only writes on the allowlist
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and role = 'admin'
  );
$$;
create policy allow_admin_insert on allowed_users for insert to authenticated with check (is_admin());
create policy allow_admin_update on allowed_users for update to authenticated using (is_admin()) with check (is_admin());
create policy allow_admin_delete on allowed_users for delete to authenticated using (is_admin());

-- 5) invite-only sign-up without confirmation emails: allowlisted emails confirm at signup, others never do
create or replace function public.auth_autoconfirm_allowlisted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from allowed_users where lower(email) = lower(new.email)) then
    new.email_confirmed_at := coalesce(new.email_confirmed_at, now());
  end if;
  return new;
end $$;
drop trigger if exists auth_autoconfirm_allowlisted_trg on auth.users;
create trigger auth_autoconfirm_allowlisted_trg
before insert on auth.users
for each row execute function public.auth_autoconfirm_allowlisted();

-- 6) documents view v2: prefer the RECEIVED row's address; cancellation action rows carry the GRANTOR
drop view if exists documents;
create view documents
with (security_invoker = true) as
select
  e.county,
  e.doc_number,
  max(e.doc_type)                                                                as doc_type,
  max(e.pdf_url)                                                                 as pdf_url,
  coalesce(
    max(nullif(btrim(e.address, ', '), '')) filter (where e.outcome = 'RECEIVED'),
    max(nullif(btrim(e.address, ', '), '')) filter (where e.outcome not ilike 'Cancellation%')
  )                                                                              as address,
  max(nullif(btrim(e.address, ', '), '')) filter (where e.outcome ilike 'Cancellation%') as grantor,
  min(e.ts)                                                                      as first_seen,
  max(e.ts)                                                                      as last_seen,
  (array_agg(e.outcome order by e.ts desc nulls last, e.id desc))[1]             as last_outcome,
  array_remove(array_agg(distinct e.outcome), null)                              as outcomes,
  bool_or(coalesce(e.note,'') ilike '%NEEDS REVIEW%' or coalesce(e.outcome,'') ilike '%NEEDS REVIEW%') as needs_review,
  (count(*) filter (where e.outcome <> 'RECEIVED') = 0)                          as skipped
from events e
where e.doc_number is not null and e.doc_number <> ''
group by e.county, e.doc_number;

-- 7) app_config keys expected by the edge functions (values set out of band, service role only):
--    ingest_secret, queue_webhook_url, make_api_base, make_scenario_id, make_datastore_id,
--    make_datastructure_id, make_api_token

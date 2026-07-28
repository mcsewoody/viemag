-- ============================================================
-- Harden the two anon-writable public forms (dealer_leads, support_cases)
--
-- These are the only tables an unauthenticated stranger on the public
-- internet can write to. The RLS policies said "insert allowed", which in
-- Postgres means "insert allowed into ANY column" — verified abuses:
--   * a visitor could set case_id, so pre-claiming SC-2026-0001..9999 made
--     every genuine warranty submission afterwards fail on the unique index
--   * a visitor could set status='Resolved', cost_owner, root_cause,
--     escalate_to_hq — i.e. file a case pre-marked handled so it never
--     surfaces in the New queue
--   * a visitor could set id and created_at (forward-dating spam leads pins
--     them to the top of the admin list)
--   * a single text field accepted 3,000,000 characters
--
-- Three independent layers below: column grants (what may be written),
-- CHECK constraints (how big), and a rate circuit breaker (how many).
-- ============================================================

-- ---------- 1. Column-level INSERT grants ----------
-- Only the fields the public forms actually collect. Everything else falls
-- back to its column DEFAULT (status='New', id, created_at, case_id), and an
-- attempt to set it is rejected by Postgres with "permission denied for
-- column ...". Staff (authenticated) are unaffected — they keep full CRUD.

revoke insert on dealer_leads from anon;
grant insert (
  company_name, contact_person, email, phone_zalo, city_region,
  channel_type, current_brands, monthly_sales_estimate, notes,
  can_meet_minimum_order
) on dealer_leads to anon;

revoke insert on support_cases from anon;
grant insert (
  customer_name, contact, product_reported, purchase_channel,
  purchase_date, issue_type, issue_description
) on support_cases to anon;

-- ---------- 2. Size limits + a usable-contact requirement ----------
-- Generous enough that no honest submission is rejected, small enough that
-- the table cannot be used as free blob storage.

alter table dealer_leads add constraint dealer_leads_field_sizes check (
  length(company_name) between 1 and 200
  and length(coalesce(contact_person, '')) <= 100
  and length(coalesce(email, '')) <= 200
  and length(coalesce(phone_zalo, '')) <= 50
  and length(coalesce(city_region, '')) <= 100
  and length(coalesce(current_brands, '')) <= 500
  and length(coalesce(notes, '')) <= 2000
  and coalesce(array_length(channel_type, 1), 0) <= 10
  and coalesce(monthly_sales_estimate, 0) between 0 and 100000000
);

-- A lead with no way to reply is unactionable. Both fields are already
-- required client-side; this makes it true regardless of the client.
alter table dealer_leads add constraint dealer_leads_reachable check (
  coalesce(email, '') <> '' or coalesce(phone_zalo, '') <> ''
);

alter table support_cases add constraint support_cases_field_sizes check (
  length(coalesce(customer_name, '')) <= 100
  and length(coalesce(contact, '')) <= 200
  and length(coalesce(product_reported, '')) <= 200
  and length(coalesce(issue_description, '')) between 1 and 3000
  and length(coalesce(root_cause, '')) <= 3000
  and coalesce(array_length(evidence_urls, 1), 0) <= 10
);

alter table support_cases add constraint support_cases_reachable check (
  coalesce(contact, '') <> ''
);

-- ---------- 3. Rate circuit breaker ----------
-- PostgREST has no per-table rate limiting and Postgres cannot see the
-- client IP here, so this is a deliberately crude global cap: it cannot stop
-- targeted abuse, but it does stop an unattended script from creating
-- millions of rows overnight (the actual finding). A dealer-application or
-- warranty form legitimately receiving >60/hour would be extraordinary; if
-- that day ever comes, raise the number or move the forms behind an Edge
-- Function with a real captcha.
--
-- SECURITY DEFINER is required: anon has no SELECT on these tables, so an
-- invoker-rights count would always see 0 under RLS. search_path is pinned
-- because SECURITY DEFINER without it is a privilege-escalation vector.

create or replace function public.guard_public_form_rate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  recent integer;
  cap    constant integer := 60;   -- per table, per hour
begin
  execute format(
    'select count(*) from public.%I where created_at > now() - interval ''1 hour''',
    tg_table_name
  ) into recent;

  if recent >= cap then
    raise exception
      'submission rate limit reached for %, please try again later', tg_table_name
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_public_form_rate() from public;

create trigger trg_dealer_leads_rate
  before insert on dealer_leads
  for each row execute function public.guard_public_form_rate();

create trigger trg_support_cases_rate
  before insert on support_cases
  for each row execute function public.guard_public_form_rate();

-- ---------- 4. Indexes on the columns /admin actually sorts and filters ----------
-- These two tables are inboxes; they grow with traffic and are the only ones
-- that will. Without these, triage queries seq-scan.
create index if not exists idx_dealer_leads_created_at  on dealer_leads (created_at desc);
create index if not exists idx_dealer_leads_status      on dealer_leads (status);
create index if not exists idx_support_cases_created_at on support_cases (created_at desc);
create index if not exists idx_support_cases_status     on support_cases (status);

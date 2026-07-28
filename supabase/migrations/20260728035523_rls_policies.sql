-- ============================================================
-- VIEMAG Backend — Row Level Security
--
-- Design:
--   • Catalog tables (categories/scenarios/products/test_reports/
--     assets/faq/guides/site_settings + the 4 product_* join
--     tables) are read ONLY by the privileged build-time export
--     script (uses the service_role key, which bypasses RLS
--     entirely). No anon SELECT policy is granted anywhere —
--     the public website never talks to Supabase directly for
--     catalog data. This is the "static export" half of the
--     hybrid architecture.
--   • dealer_leads / support_cases are written directly from the
--     public site's forms using the anon key ("runtime insert"
--     half of the hybrid). anon may INSERT only — never SELECT/
--     UPDATE/DELETE, so a submitted lead can never be read back
--     or tampered with by another visitor.
--   • authenticated (= logged-in admin staff in /admin) gets full
--     CRUD on every table. Public sign-up must stay OFF (configure
--     in Supabase Auth settings) — every "authenticated" user is
--     someone we manually invited, so this is safe to trust broadly.
-- ============================================================

alter table categories               enable row level security;
alter table scenarios                enable row level security;
alter table products                 enable row level security;
alter table test_reports             enable row level security;
alter table assets                   enable row level security;
alter table faq                      enable row level security;
alter table guides                   enable row level security;
alter table site_settings            enable row level security;
alter table dealer_leads             enable row level security;
alter table support_cases            enable row level security;
alter table product_scenarios        enable row level security;
alter table product_test_reports     enable row level security;
alter table product_faqs             enable row level security;
alter table product_related_products enable row level security;

-- ---------- authenticated staff: full CRUD everywhere ----------
create policy "staff full access" on categories               for all to authenticated using (true) with check (true);
create policy "staff full access" on scenarios                for all to authenticated using (true) with check (true);
create policy "staff full access" on products                 for all to authenticated using (true) with check (true);
create policy "staff full access" on test_reports              for all to authenticated using (true) with check (true);
create policy "staff full access" on assets                    for all to authenticated using (true) with check (true);
create policy "staff full access" on faq                       for all to authenticated using (true) with check (true);
create policy "staff full access" on guides                    for all to authenticated using (true) with check (true);
create policy "staff full access" on site_settings              for all to authenticated using (true) with check (true);
create policy "staff full access" on dealer_leads               for all to authenticated using (true) with check (true);
create policy "staff full access" on support_cases              for all to authenticated using (true) with check (true);
create policy "staff full access" on product_scenarios         for all to authenticated using (true) with check (true);
create policy "staff full access" on product_test_reports      for all to authenticated using (true) with check (true);
create policy "staff full access" on product_faqs              for all to authenticated using (true) with check (true);
create policy "staff full access" on product_related_products  for all to authenticated using (true) with check (true);

-- ---------- anon: insert-only on the two public form tables ----------
create policy "public can submit a dealer lead" on dealer_leads
  for insert to anon
  with check (true);

create policy "public can submit a support case" on support_cases
  for insert to anon
  with check (true);

-- No other anon policy exists anywhere — catalog tables have zero
-- anon grants (RLS default-denies), so js/data.js MUST keep coming
-- from the privileged export script, never a direct browser call
-- with the anon key.

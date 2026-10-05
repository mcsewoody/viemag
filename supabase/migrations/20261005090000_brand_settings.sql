-- ============================================================
-- VIEMAG — the legal block printed on every box, held once
--
-- Decree 37/2026/ND-CP requires every box sold in Vietnam to name the
-- organisation responsible for the goods and give its address, plus the
-- importer where the goods are imported. That text is identical on every SKU,
-- so it belongs in one row, not copied onto thirty products where thirty boxes
-- can drift apart.
--
-- It lived in admin/packaging-export.js as a BRAND constant of five empty
-- strings, with a TODO saying to move it here once the Vietnamese entity's
-- registered name was confirmed. Two problems with leaving it there: that file
-- is served at https://viemag.biz/admin/packaging-export.js, so a company
-- address in it is public; and changing an address meant a commit and a deploy
-- rather than an edit.
--
-- NOT translated, on purpose. A registered company name and a registered
-- address have to be reproduced exactly as they appear on the business
-- licence. Running them through DeepL would produce a plausible-looking
-- address that is not the legal one. Only warranty_terms_* is prose, so only
-- warranty_terms_* has four languages.
--
-- Owner-only for WRITE, all staff for READ. This is the one piece of packaging
-- data that is a legal declaration rather than product copy: an editor needs to
-- see it on an export, but changing who is legally responsible for the goods is
-- not an editor's call.
-- ============================================================

create table if not exists public.brand_settings (
  -- Singleton. The check constraint is what makes it one: a second insert can
  -- only ever use id = 1 and will collide with the primary key. Simpler than a
  -- partial unique index and it fails with a message that says why.
  id                     int primary key default 1 check (id = 1),

  -- The organisation that answers for the goods. May be the Taiwanese
  -- manufacturer or the Vietnamese importer depending on the actual legal
  -- relationship for that shipment — Article 42 cares that it is named and
  -- reachable, not which one it is.
  responsible_company    text,
  responsible_address    text,

  -- Separate from the above because the common case is a Taiwanese responsible
  -- company and a Vietnamese importer, and the box has to carry both.
  importer_name          text,
  importer_address       text,

  -- At least one channel a buyer can actually use — a phone number or an email.
  -- Consumer-protection law expects this next to the responsible-party block.
  customer_contact       text,

  -- Warranty and exchange/return conditions. The numbers live on
  -- products.warranty_months and products.defect_exchange_days because they
  -- vary per SKU; this is the sentence around them, which does not. Vietnamese
  -- is the one that legally has to be there.
  warranty_terms_en      text,
  warranty_terms_vi      text,
  warranty_terms_id      text,
  warranty_terms_zh      text,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.brand_settings is
  'One row. The responsible-company, importer, customer-contact and warranty block printed on every box. Read by all staff, written by owners only, and never part of the public site export.';

comment on column public.brand_settings.responsible_company is
  'Registered company name, reproduced exactly as on the business licence. Never machine-translated.';
comment on column public.brand_settings.importer_name is
  'Registered name of the Vietnamese importer. Required on the label when the goods are imported.';

-- Seed the single row so /admin edits an existing record instead of needing an
-- insert path. Every column is null: the packaging export prints a [FAIL] line
-- until they are filled in, which is the intended state until legal confirms
-- the registered names.
insert into public.brand_settings (id) values (1)
  on conflict (id) do nothing;

create trigger trg_brand_settings_updated_at before update on public.brand_settings
  for each row execute function set_updated_at();

-- ---------- RLS ----------
alter table public.brand_settings enable row level security;

-- Everyone signed in may read it: an editor exporting packaging text needs the
-- block to appear on the file they hand the designer.
create policy brand_settings_staff_read on public.brand_settings
  for select to authenticated using (true);

-- Only an owner may change who is legally responsible for the goods.
create policy brand_settings_owner_write on public.brand_settings
  for update to authenticated
  using (exists (select 1 from public.admin_users au
                 where au.user_id = auth.uid() and au.role = 'owner'))
  with check (exists (select 1 from public.admin_users au
                      where au.user_id = auth.uid() and au.role = 'owner'));

-- No insert policy and no delete policy, so neither is possible for anyone
-- through PostgREST. The single row is seeded above and is meant to stay.

revoke all on public.brand_settings from anon;

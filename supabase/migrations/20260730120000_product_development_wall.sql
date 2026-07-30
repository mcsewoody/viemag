-- VIEMAG — the owner-only development/cost wall (step 1 of 2: additive only)
--
-- Woody's decision (2026-07-30): the product editor splits into three tabs.
--   Tab 1  fields that reach the public site        — every logged-in staff member
--   Tab 2  internal sales reference                 — every logged-in staff member
--   Tab 3  development + cost, PM territory         — OWNERS ONLY, enforced here
--
-- Tab 3 is a REAL permission boundary, not a hidden tab. Hiding a tab in
-- JavaScript hides nothing: until this migration, every RLS policy on products
-- was `for all to authenticated using (true)`, so any account that could log in
-- could read every column with one console call. A wall that only exists in the
-- UI is worse than no wall, because whoever fills the fields in believes it
-- protects them.
--
-- WHY A SEPARATE TABLE rather than more columns on products:
--   1. Postgres RLS is row-level, not column-level. Restricting single columns
--      means GRANT SELECT (list), and /admin loads rows with select('*') — one
--      restricted column would make the whole table unreadable.
--   2. export-site-data cannot read a table it never mentions. Supplier names
--      are the one piece of data in this system that could re-link the brand to
--      its parent company, which the brand rules treat as the highest-priority
--      confidentiality boundary. On products, one careless addition to
--      PRODUCT_COLS would publish it to viemag.biz. Here that mistake is
--      structurally impossible. scripts/audit-field-parity.mjs direction E
--      asserts the exporter never names this table.
--
-- WHAT THE WALL DOES AND DOES NOT PROTECT (agreed explicitly, so nobody later
-- assumes more than it delivers): sales staff see the summed sales cost, so the
-- purchase price is roughly INFERABLE by anyone who knows what freight and
-- packaging cost. That is unavoidable — any number a salesperson can quote from
-- reveals the cost basis it was derived from. The wall protects the EXACT
-- purchase price, WHO the supplier is, and the cost STRUCTURE. Those are the
-- things whose disclosure actually matters, and against those it is effective.
--
-- Split into two migrations on purpose. This one only ADDS, so the currently
-- deployed /admin keeps working while GitHub Pages publishes the new code;
-- 20260730130000 drops the three orphaned columns afterwards. A single
-- migration would leave /admin broken for the length of a Pages deploy no
-- matter which order it ran in.

begin;

-- ---------- 1. products: three new sales-reference columns (tab 2) ----------
-- map_usd replaces promo_floor, which was broken: its description said "floor
-- PRICE" but its type was numeric(4,3), max value 9.999 — a $19.90 floor would
-- have been rejected outright. It was designed as a ratio and documented as a
-- price. 0 of 19 rows were ever filled, so nobody found out. MAP (Minimum
-- Advertised Price) is the term the sales side already uses, so the field is
-- reintroduced under that name with a price type. promo_floor is dropped in
-- step 2, not here.
alter table public.products
  add column map_usd     numeric(10,2),
  add column wsp_usd     numeric(10,2),
  add column distributor text;

comment on column public.products.map_usd is
  'Minimum Advertised Price. Replaces promo_floor, which was typed as a ratio but documented as a price.';
comment on column public.products.wsp_usd is
  'Wholesale Selling Price offered to distributors.';

-- ---------- 2. gross margin: store percent, not a ratio ----------
-- numeric(4,3) meant 35% had to be entered as 0.350, which forces a x100 / /100
-- conversion layer in the form and makes a spot-check in the Supabase table
-- editor a mental arithmetic exercise. Nothing consumes these columns
-- programmatically — they are internal reference and never exported — so the
-- ratio bought nothing. 0 rows, so retyping converts no data.
alter table public.products
  alter column target_gross_margin  type numeric(5,2),
  alter column minimum_gross_margin type numeric(5,2);

comment on column public.products.target_gross_margin is
  'Target gross margin as a PERCENT (35.00 = 35%), measured against the summed sales cost.';
comment on column public.products.minimum_gross_margin is
  'Minimum acceptable gross margin, PERCENT. /admin warns below this but never blocks saving: a clearance price under the floor is a business decision, and blocking it only teaches people to enter a fake number.';

-- ---------- 3. status gains 'Development' ----------
-- Woody dropped the idea of a separate product library and uses products.status
-- to mark pipeline items instead. 'Draft' already means "the copy is not
-- finished"; 'Development' means "the product does not exist yet". They wait on
-- different things (copy vs tooling) and different people, and collapsing them
-- would make the list unable to answer "how many projects are running" — which
-- is the exact question status is now supposed to answer.
--
-- Safe to add: the exporter allowlists (`r.status === 'Published'`), so any new
-- value is withheld from the site by default rather than leaked by default.
alter table public.products drop constraint products_status_check;
alter table public.products add constraint products_status_check
  check (status in ('Development', 'Draft', 'Review', 'Published', 'Hidden', 'Discontinued'));

-- ---------- 4. the owner-only table ----------
-- product_id (uuid, FK to products.id) follows the naming already used by all
-- four join tables. Note the trap: products.product_id is the TEXT SKU, so the
-- same name means two different things depending on the table. Following the
-- established convention beats inventing a second one — inconsistent is worse
-- than confusing.
create table public.product_development (
  product_id                uuid primary key references public.products(id) on delete cascade,

  -- cost stack: 8 components, summed into sales_cost_usd below
  purchase_cost_usd         numeric(10,2),
  packaging_cost_usd        numeric(10,2),
  inspection_cost_usd       numeric(10,2),
  freight_cost_usd          numeric(10,2),
  licensing_fee_usd         numeric(10,2),
  patent_fee_usd            numeric(10,2),
  tooling_amortization_usd  numeric(10,2),
  other_cost_usd            numeric(10,2),

  -- One shared note for all eight, deliberately not one source field each.
  -- Everything here is USD, and a supplier quote usually is not, so the
  -- conversion has to be recorded somewhere or it is lost. Eight note fields
  -- would become eight empty fields; one has a chance of being used.
  cost_note                 text,

  -- Generated, never typed. This is the number the sales tab reads through the
  -- view below. A stored copy maintained by hand or by trigger could drift from
  -- its components; a generated column cannot.
  sales_cost_usd            numeric(12,2) generated always as (
                              coalesce(purchase_cost_usd, 0)
                            + coalesce(packaging_cost_usd, 0)
                            + coalesce(inspection_cost_usd, 0)
                            + coalesce(freight_cost_usd, 0)
                            + coalesce(licensing_fee_usd, 0)
                            + coalesce(patent_fee_usd, 0)
                            + coalesce(tooling_amortization_usd, 0)
                            + coalesce(other_cost_usd, 0)
                            ) stored,

  -- project info
  supplier                  text,
  design_link               text,
  inventory_first_batch     integer,
  certification_notes       text,

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.product_development is
  'Owner-only development and cost record, 1:1 with products. Never exported to the public site — see audit direction E.';
comment on column public.product_development.supplier is
  'Plain text on purpose: three to five distinct values do not justify a table, and a suppliers table would appear in the /admin sidebar where editors would see the list.';
comment on column public.product_development.design_link is
  'A link to the drawing, NOT an upload. The viemag-media bucket is public (public=true plus a `to public` select policy), so a drawing uploaded through the normal image widget would be fetchable by URL with no login — and a drawing title block routinely carries the manufacturer name. Links must be shared to named people, not "anyone with the link".';
comment on column public.product_development.tooling_amortization_usd is
  'Entered by hand, not derived. Amortisation is not always straight-line (shared with the customer, already fully amortised, amortised over a period rather than a quantity); the reasoning belongs in cost_note.';

create trigger trg_product_development_updated_at before update on public.product_development
  for each row execute function set_updated_at();

alter table public.product_development enable row level security;

-- Supabase grants ALL on new public tables to anon and authenticated by
-- default, so RLS alone would leave anon holding write grants. Strip, then
-- re-grant to authenticated only, and let the policy do the real filtering.
revoke all on public.product_development from anon;
revoke all on public.product_development from authenticated;
grant select, insert, update, delete on public.product_development to authenticated;

create policy product_development_owner_only on public.product_development
  for all to authenticated
  using      (exists (select 1 from public.admin_users au
                       where au.user_id = auth.uid() and au.role = 'owner'))
  with check (exists (select 1 from public.admin_users au
                       where au.user_id = auth.uid() and au.role = 'owner'));

-- ---------- 5. the one number that crosses the wall ----------
-- Sales needs a cost basis to quote against; it must not see the components.
-- A view with security_invoker left at its default (false) runs with the view
-- owner's privileges, so it reads straight past the owner-only policy above and
-- exposes exactly two columns and nothing else.
create view public.product_sales_cost as
  select product_id, sales_cost_usd
    from public.product_development;

comment on view public.product_sales_cost is
  'The only part of product_development any staff member can read: the summed sales cost, for the gross-margin display in the sales tab. security_invoker stays false on purpose — that is what lets this cross the owner-only policy while the components stay behind it.';

revoke all on public.product_sales_cost from anon;
grant select on public.product_sales_cost to authenticated;

commit;

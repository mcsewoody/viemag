-- ============================================================
-- VIEMAG — packaging text, one record per product
--
-- Everything a packaging designer needs to lay out a box, held per SKU instead
-- of in a Word file that is emailed around. Driven by Decree 37/2026/ND-CP
-- (in force 2026-01-23, replacing 43/2017 and 111/2021), which requires every
-- box sold in Vietnam to carry, at minimum, a Vietnamese product name, the name
-- and address of the responsible organisation, and the country of origin — plus
-- whatever Appendix I demands for that product category.
--
-- Why a separate table rather than more columns on products:
--   • products is already wide, and every column there has to be considered by
--     the export whitelist in supabase/functions/export-site-data. None of this
--     belongs on the website, so none of it should be sitting next to columns
--     that do.
--   • It is the same shape as product_development — 1:1, edited as a tab of the
--     product form — so /admin needed no new concept to render it.
--
-- NOT owner-only. Packaging copy is printed on a box that ships to the public;
-- it is not cost or supplier data. Any signed-in staff may read and write it.
-- The reason it never reaches viemag.biz is that it is packaging text, not site
-- copy — a different thing from being confidential.
-- ============================================================

create table if not exists public.product_packaging (
  -- Named product_id but holds products.id (uuid), exactly as
  -- product_development does. /admin's saveSubRecord writes this key by name,
  -- so the name and type must match that table or the shared code path breaks.
  product_id                      uuid primary key references public.products(id) on delete cascade,

  -- ---------- one value, no language ----------

  -- Where this SKU's packaging is in its own workflow. Separate from
  -- products.status, which is about the website: a product can be Published on
  -- the site for months while its box is still a Draft.
  packaging_status                text,

  -- Decides which technical-specification block below applies. The legal
  -- category follows from it too: Appendix I asks a charging product for a year
  -- of manufacture and a bare magnetic bracket does not.
  packaging_product_type          text,

  -- Usually blank. The exporter falls back to official_sku_code, then
  -- product_id, so this is only for the rare box that prints something else.
  model_number                    text,

  -- TEXT, deliberately, never a numeric type: an EAN-13 may begin with 0 and a
  -- numeric column would silently eat it. Length and the check digit are
  -- validated in the packaging export, not by a constraint here — a half-typed
  -- code must still be savable, or people keep it in a notebook instead.
  barcode_ean_upc                 text,

  -- ---------- four languages each ----------
  -- id = Indonesian, not "identifier". zh is Traditional; Simplified is derived
  -- at display time and never stored. Same convention as products.

  -- 1. Product name as printed. Article 42 is explicit that a brand name or a
  -- model number is not a product name: "VIEMAG" and "V01" do not qualify,
  -- "Giá đỡ điện thoại nam châm gắn cửa gió ô tô" does. Kept apart from
  -- products.name_* because that one is marketing copy for a web page.
  packaging_name_en               text,
  packaging_name_vi               text,
  packaging_name_id               text,
  packaging_name_zh               text,

  -- 3. Instructions for use, storage, and any warnings.
  instructions_precautions_en     text,
  instructions_precautions_vi     text,
  instructions_precautions_id     text,
  instructions_precautions_zh     text,

  -- 4. What is in the box, one item per line. Falls back to products.accessories_*.
  package_contents_en             text,
  package_contents_vi             text,
  package_contents_id             text,
  package_contents_zh             text,

  -- 5. Main material / composition.
  main_material_en                text,
  main_material_vi                text,
  main_material_id                text,
  main_material_zh                text,

  -- 6A. Magnetic bracket: compatible phones, cases, adapter rings, clamping
  -- width, magnet grade. One block rather than one column per attribute — it
  -- prints as one paragraph on the box, and a new attribute should not need a
  -- migration.
  magnetic_bracket_specs_en       text,
  magnetic_bracket_specs_vi       text,
  magnetic_bracket_specs_id       text,
  magnetic_bracket_specs_zh       text,

  -- 6B. Charging product: input voltage/current, wireless output power, the
  -- supply conditions needed to reach it, connector type, wired output.
  charging_specs_en               text,
  charging_specs_vi               text,
  charging_specs_id               text,
  charging_specs_zh               text,

  -- 6C. Power bank: cell type, capacity, nominal voltage, per-port input and
  -- output, the total limit when several ports run at once, wireless power.
  power_bank_specs_en             text,
  power_bank_specs_vi             text,
  power_bank_specs_id             text,
  power_bank_specs_zh             text,

  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

comment on table public.product_packaging is
  'Packaging text, 1:1 with products, exported as a .txt for the packaging designer. Readable and writable by all staff, and never part of the public site export.';

comment on column public.product_packaging.barcode_ean_upc is
  'EAN-13 as TEXT. A numeric type would drop a leading zero. Length and check digit are validated at export time, not by a constraint.';
comment on column public.product_packaging.packaging_product_type is
  'Which technical-specification block applies: Magnetic bracket, Charging product, Power bank, or Combined product. Also the hint for which Appendix I category the SKU falls in.';
comment on column public.product_packaging.packaging_name_vi is
  'The Vietnamese product name printed on the box. Required by Article 42 and not substitutable by a brand name or model number.';

-- There is no year-of-manufacture column on purpose. It changes with every
-- production batch and is not a property of the SKU: storing it here would mean
-- that updating it erased what last year's boxes said. The export prints a
-- blank line for it instead, to be filled in at print time.

create trigger trg_product_packaging_updated_at before update on public.product_packaging
  for each row execute function set_updated_at();

-- ---------- RLS ----------
-- Same policy as the catalogue tables in 20260728035523_rls_policies.sql: every
-- authenticated user is someone who was invited by hand, so staff get full CRUD
-- and anon gets nothing. Not behind the owner-only wall — see the header.
alter table public.product_packaging enable row level security;

create policy "staff full access" on public.product_packaging
  for all to authenticated using (true) with check (true);

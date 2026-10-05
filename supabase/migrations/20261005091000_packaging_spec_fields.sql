-- ============================================================
-- VIEMAG — per-attribute packaging specs, plus the label fields Appendix I asks
-- for that 20260930120000 did not model
--
-- Two deliberate decisions in that migration are revisited here. Both were
-- right at the time and both are written out below rather than quietly undone.
--
-- 1. "One block rather than one column per attribute" (20260930120000:84-87).
--    The reasoning was that the box prints one paragraph and a new attribute
--    should not need a migration. What that cost in practice: nothing could be
--    validated — a power bank shipping without its watt-hour figure is an
--    air-freight problem and a free-text block cannot notice — and every line
--    of it went through DeepL in three target languages even when the line was
--    "9V / 2A", which is the same characters in all four.
--    So: attributes that are a NUMBER AND A UNIT get their own column with no
--    language suffix, and the three *_specs_* blocks STAY, demoted to the notes
--    field of their section. That is where a sentence like "needs a 30W PD
--    adapter to reach full output" belongs, and it still carries four
--    languages. Nothing is migrated out of them; they keep printing as before.
--
-- 2. "There is no year-of-manufacture column on purpose" (20260930120000:121-124).
--    The reasoning — it is a batch property, not a SKU property, and storing it
--    would mean an update erases what last year's boxes said — still holds.
--    But Appendix I category 40 lists "Năm sản xuất" as mandatory content for
--    electrical and electronic goods, so a designer laying out that box needs
--    a value, not a blank. The column added here is OPTIONAL: left empty, the
--    export keeps printing the blank fill-in line exactly as it does today.
--
-- Every column is nullable and added with `if not exists`. No data is moved, no
-- column is renamed, and no column is dropped.
--
-- All of this is internal — it must never be added to the export whitelist in
-- supabase/functions/export-site-data. scripts/audit-field-parity.mjs direction
-- A skips tables marked notePackaging; direction D fails if any of these ever
-- shows up in a *_COLS list.
-- ============================================================

-- ---------- general label content ----------

alter table public.product_packaging
  -- Mandatory on every label under Article 42, whatever the category. Stays per
  -- SKU rather than in brand_settings because it genuinely differs: the same
  -- brand ships boxes made in China and boxes made in Vietnam.
  add column if not exists country_of_origin        text,

  -- Optional. See decision 2 in the header: empty means "print the blank line".
  add column if not exists manufacturing_year       text,

  -- Appendix I lists "hướng dẫn sử dụng" and "hướng dẫn bảo quản" as one item
  -- and "thông tin cảnh báo" as another. instructions_precautions_* already
  -- holds use and warnings; storage was folded in with them, which worked until
  -- a designer needed to set them as two blocks. New column, so nothing is
  -- split out of the old one — fill it in when a SKU is next reviewed.
  add column if not exists storage_instructions_en  text,
  add column if not exists storage_instructions_vi  text,
  add column if not exists storage_instructions_id  text,
  add column if not exists storage_instructions_zh  text,

  -- Anything else the designer has to know that is not itself printed: "the
  -- side label has to clear the hanging hole", that sort of thing.
  add column if not exists packaging_notes_en       text,
  add column if not exists packaging_notes_vi       text,
  add column if not exists packaging_notes_id       text,
  add column if not exists packaging_notes_zh       text;

-- ---------- 6A. magnetic bracket ----------
-- No language suffix on any of these: "N52" and "6-9" read identically in
-- English, Vietnamese, Indonesian and Chinese, so a translated copy would be
-- four chances to mistype one number.

alter table public.product_packaging
  add column if not exists magnet_grade             text,
  add column if not exists clamp_range_mm           text;

-- ---------- 6B. charging product ----------
-- TEXT, not numeric, for the same reason barcode_ean_upc is text: the value
-- that goes on a box is "9V", "5V⎓3A", "15W", sometimes a range. A numeric
-- column would force the unit into the column name and still not hold a range.

alter table public.product_packaging
  add column if not exists input_voltage            text,
  add column if not exists input_current            text,
  add column if not exists input_power              text,
  add column if not exists wireless_output_power    text,
  add column if not exists max_output_power         text,
  add column if not exists connector_type           text,
  add column if not exists wired_output_voltage     text,
  add column if not exists wired_output_current     text,
  add column if not exists wired_output_power       text;

-- ---------- 6C. power bank ----------

alter table public.product_packaging
  add column if not exists battery_type             text,
  add column if not exists battery_capacity_mah     text,
  add column if not exists rated_voltage            text,
  add column if not exists watt_hour_wh             text,
  -- One column per port rather than a list, because each port prints as its own
  -- line and they are not interchangeable. Three is what the hardware has; a
  -- fourth would be a migration, which is the right amount of friction.
  add column if not exists port1_spec               text,
  add column if not exists port2_spec               text,
  add column if not exists port3_spec               text,
  -- The ceiling when several ports draw at once. Not derivable from the ports:
  -- a 65W bank with three 45W ports still totals 65W.
  add column if not exists max_combined_output      text;

-- ---------- lithium cells ----------

alter table public.product_packaging
  -- Stricter than the general warning block and legally separate, so it is its
  -- own field rather than a paragraph someone may forget inside
  -- instructions_precautions_*.
  add column if not exists lithium_warning_en       text,
  add column if not exists lithium_warning_vi       text,
  add column if not exists lithium_warning_id       text,
  add column if not exists lithium_warning_zh       text,

  -- Air-freight marking. Not printed on the retail box as such — it drives the
  -- outer-carton labelling and the shipper's paperwork — but the designer needs
  -- to know it applies before laying out the panel.
  add column if not exists iata_notes               text;

comment on column public.product_packaging.manufacturing_year is
  'Optional. Appendix I category 40 requires a year of manufacture on electrical goods. Left empty, the export prints the blank fill-in line instead, because the value belongs to a production batch rather than to the SKU.';
comment on column public.product_packaging.country_of_origin is
  'Mandatory on every label under Article 42. Per SKU, not per brand: the same brand ships boxes made in different countries.';
comment on column public.product_packaging.watt_hour_wh is
  'Watt-hours of the cell. Required before a power bank can be air-freighted, which is why the admin form refuses to save a Power bank without it.';
comment on column public.product_packaging.magnetic_bracket_specs_en is
  'Now the NOTES field of section 6A: the prose that the per-attribute columns cannot hold, such as which phone cases and adapter rings fit. The measurable attributes moved to magnet_grade and clamp_range_mm.';
comment on column public.product_packaging.charging_specs_en is
  'Now the NOTES field of section 6B, for conditions like "needs a 30W PD adapter to reach full output". The measurable attributes moved to the input_*, output_* and connector_type columns.';
comment on column public.product_packaging.power_bank_specs_en is
  'Now the NOTES field of section 6C. The measurable attributes moved to the battery_*, rated_voltage, watt_hour_wh and port*_spec columns.';

-- No CHECK constraint on connector_type or battery_type, matching
-- packaging_status and packaging_product_type: the option list lives in
-- admin/schema.js so that adding a connector does not need a migration, and
-- audit-field-parity.mjs direction G is what makes sure every option has a
-- translated label.

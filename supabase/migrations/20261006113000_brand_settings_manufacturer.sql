-- Split the manufacturer from the responsible-company block.
--
-- The packaging-source documents keep "responsible company / manufacturer" and
-- "Vietnam importer" as separate label lines. Earlier admin wording allowed the
-- responsible company to stand for the manufacturer when the legal relationship
-- made that correct, but it gave staff no place to record a distinct maker.
-- Keep this in brand_settings because it is legal label text reused across the
-- packaging export, not a public product-page specification.

alter table public.brand_settings
  add column if not exists manufacturer_name text,
  add column if not exists manufacturer_address text;

comment on column public.brand_settings.manufacturer_name is
  'Registered manufacturer name when it must be printed separately from the responsible company. Never machine-translated.';

comment on column public.brand_settings.manufacturer_address is
  'Full registered manufacturer address when the manufacturer line is used.';

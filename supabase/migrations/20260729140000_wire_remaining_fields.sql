-- VIEMAG — make every admin-editable field either reach the site or say it doesn't
--
-- The 2026-07-29 audit found ~20 columns that staff could edit in /admin with no
-- effect on the public site. Woody's decisions (same date) were: wire the ones
-- that are real content, drop the duplicates, and label the rest internal.
--
-- This migration only covers the columns that need a SHAPE change. Several
-- audited fields needed no migration at all and are handled purely in the export
-- function + front end:
--   products.warranty_months / defect_exchange_days  (already integers, 19/19 filled)
--   products.gallery_urls / spec_sheet_url           (already the right types)
--   products.consumer_pain_point                     (text[] of 5 fixed tags —
--       a tag set, NOT prose, so it needs i18n labels rather than per-SKU
--       translation. Nothing to migrate.)
--   scenarios.hero_image_url                         (already text)
--   faq.category                                     (already text + constraint)
--
-- Every column touched below is empty in production, so no data is at risk.
-- Verified before writing this: products.seo_title_vi 0/19, seo_description_vi
-- 0/19, categories.hero_copy_vi 0/6, categories.seo_title_vi 0/6,
-- scenarios.pain_point_vi 0/6.

-- ============================================================
-- 1. categories.hero_copy_vi — a duplicate, removed
-- ============================================================
-- categories already has desc_en/vi/id/zh, which IS exported and IS used on the
-- category cards and listing page. A second, Vietnamese-only copy field with no
-- consumer just forces staff to guess which one is the real one.
alter table public.categories drop column hero_copy_vi;

-- ============================================================
-- 2. SEO fields — one language became four
-- ============================================================
-- These were Vietnamese-only, which cannot serve a five-language site: an
-- English page would have had to choose between a Vietnamese <title> and no
-- title at all. Same en/vi/id/zh convention as every other translatable field;
-- Simplified Chinese is converted from zh at runtime.
alter table public.products
  drop column seo_title_vi,
  drop column seo_description_vi;
alter table public.products
  add column seo_title_en       text,
  add column seo_title_vi       text,
  add column seo_title_id       text,
  add column seo_title_zh       text,
  add column seo_description_en text,
  add column seo_description_vi text,
  add column seo_description_id text,
  add column seo_description_zh text;

alter table public.categories
  drop column seo_title_vi,
  drop column seo_description_vi;
alter table public.categories
  add column seo_title_en       text,
  add column seo_title_vi       text,
  add column seo_title_id       text,
  add column seo_title_zh       text,
  add column seo_description_en text,
  add column seo_description_vi text,
  add column seo_description_id text,
  add column seo_description_zh text;

comment on column public.products.seo_title_en is
  'Optional <title> override. Blank is the normal case — the page composes one from the product name.';

-- ============================================================
-- 3. scenarios.pain_point_vi — one language became four
-- ============================================================
-- The pain point is the reason a scenario page exists ("what goes wrong for you
-- here"), so it belongs on the page in whatever language the visitor chose.
alter table public.scenarios drop column pain_point_vi;
alter table public.scenarios
  add column pain_point_en text,
  add column pain_point_vi text,
  add column pain_point_id text,
  add column pain_point_zh text;

comment on column public.scenarios.hero_image_url is
  'Real photograph for this scenario. When empty the page falls back to the built-in icon, so it is safe to leave blank.';

-- ============================================================
-- 4. Indexes for the two join tables that stopped being no-ops
-- ============================================================
-- product_faqs and product_related_products are now read by the export
-- function, which walks them per product. The forward direction is covered by
-- each table's primary key; these cover the reverse lookups.
create index if not exists product_faqs_faq_idx
  on public.product_faqs (faq_id);
create index if not exists product_related_products_related_idx
  on public.product_related_products (related_product_id);

-- FAQ is now grouped by category on the support page, and ordered within a
-- group. Tiny table today, but the index costs nothing and documents the access
-- pattern.
create index if not exists faq_category_idx
  on public.faq (status, category, faq_key);

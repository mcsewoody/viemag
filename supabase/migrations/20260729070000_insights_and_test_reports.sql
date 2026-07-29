-- VIEMAG — connect test_reports and guides to the public site; delete site_settings
--
-- Decisions taken by Woody, 2026-07-29:
--   test_reports  -> shown on the product page, clickable; many-to-many with
--                    products (a report can cover several SKUs, and a SKU can
--                    have several reports). The join table already exists.
--   guides        -> a new public section titled "VIEMAG 科技洞察 / VIEMAG
--                    Insights" with five fixed categories.
--   site_settings -> deleted from both the database and /admin. Links that used
--                    to be configurable there are hard-coded instead.
--   assets        -> deliberately untouched; Woody is designing a "產品庫"
--                    (planning-stage product library) that will reshape it.
--
-- Both tables being reshaped hold ZERO rows, so nothing needs migrating. That
-- is also why this is worth doing now rather than living with the old shape.
--
-- WHY THE COLUMNS CHANGE: both tables came from Notion with a single-language
-- design that cannot serve this site. `test_reports.result_summary_vi` was
-- Vietnamese-only, so an English or Chinese visitor would have been shown
-- Vietnamese prose. `guides.language` modelled one ROW per language, but the
-- front end switches language at runtime from one record with per-language
-- columns (see products.name_en/vi/id/zh, faq.question_en/...). Both now follow
-- that convention: 4 columns per translatable field (en/vi/id/zh); Simplified
-- Chinese is generated from zh at runtime by the T2S layer in js/main.js.

-- ============================================================
-- 1. site_settings — gone
-- ============================================================
-- 0 rows, never exported, and every page's copy lives in the HTML + js/i18n.js.
-- The one thing it was going to hold (a store-level Shopee URL) is hard-coded in
-- the export function's STATIC.config block, which is where it stays.
drop table if exists public.site_settings cascade;

-- ============================================================
-- 2. test_reports — multilingual, sortable, publish-gated
-- ============================================================
alter table public.test_reports
  drop column report_name,
  drop column result_summary_vi,
  drop column limitations;

alter table public.test_reports
  add column title_en       text,
  add column title_vi       text,
  add column title_id       text,   -- Indonesian, not a numeric id
  add column title_zh       text,
  add column summary_en     text,
  add column summary_vi     text,
  add column summary_id     text,
  add column summary_zh     text,
  -- Kept as a first-class field, not a note: under Vietnam's advertising rules a
  -- performance claim has to travel with the conditions it was measured under.
  add column limitations_en text,
  add column limitations_vi text,
  add column limitations_id text,
  add column limitations_zh text,
  add column sort_order     integer not null default 0;

comment on table public.test_reports is
  'Test evidence shown on product pages. Published only when public_status = Public AND approved_for_marketing = true.';
comment on column public.test_reports.report_file_url is
  'Public URL of the report PDF/image. The product page links to this; a report with no file is still listed, just not clickable.';
comment on column public.test_reports.limitations_en is
  'Conditions and caveats of the measurement. Rendered next to the result, never hidden.';

-- Sorting the list on a product page, and the /admin list view.
create index test_reports_sort_idx on public.test_reports (sort_order, tested_date desc);
-- The export walks products -> reports; without this the join is a seq scan per product.
create index product_test_reports_report_idx on public.product_test_reports (test_report_id);

-- ============================================================
-- 3. guides -> the Insights section
-- ============================================================
alter table public.guides
  drop column article_title,
  drop column language,
  drop column topic,
  drop column content_body,
  drop column seo_title,        -- single-language, unused; SEO work is deferred
  drop column seo_description;

alter table public.guides
  add column category   text check (category in (
    'Magnetic Technology',   -- 磁吸科技
    'Charging Standards',    -- 充電標準
    'Apple Ecosystem',       -- Apple 生態
    'Industry Trends',       -- 產業趨勢
    'Tech Explained'         -- 技術解讀
  )),
  add column title_en   text,
  add column title_vi   text,
  add column title_id   text,
  add column title_zh   text,
  -- Card text on the listing page. Kept separate from the body so a listing does
  -- not have to ship (or truncate) whole articles.
  add column excerpt_en text,
  add column excerpt_vi text,
  add column excerpt_id text,
  add column excerpt_zh text,
  add column body_en    text,
  add column body_vi    text,
  add column body_id    text,
  add column body_zh    text,
  add column hero_image_url text,
  add column art_key        text,   -- fall back to a built-in illustration when there is no photo
  add column published_date date,
  add column sort_order     integer not null default 0;

-- slug is the article's public URL key (insight.html?slug=...), so it has to
-- exist and be unique. It was already unique but nullable.
alter table public.guides alter column slug set not null;

comment on table public.guides is
  'Articles for the public Insights section (VIEMAG 科技洞察 / VIEMAG Insights). Published only when status = Published.';
comment on column public.guides.slug is
  'Public URL key: insight.html?slug=<slug>. Required and unique — changing it breaks existing links.';
comment on column public.guides.category is
  'One of the five fixed Insights categories. Adding one means updating this constraint, admin/schema.js, and the i18n labels in js/i18n.js.';

create index guides_published_idx on public.guides (status, category, sort_order, published_date desc);

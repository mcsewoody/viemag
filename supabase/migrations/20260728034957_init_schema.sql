-- ============================================================
-- VIEMAG Backend — initial schema (Notion → Supabase migration)
-- Mirrors 後台.md 第七章 (backfilled 2026-07-15 to real Notion state).
-- 10 tables + 4 join tables for the multi-relations that lived on
-- the Products side in Notion (Scenario / Test Reports / FAQ /
-- Related Products were all multi-relations owned by Products).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- shared updated_at trigger ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1. categories
-- ============================================================
create table categories (
  id                  uuid primary key default gen_random_uuid(),
  category_name       text not null,
  slug                text unique not null,
  name_en             text,
  name_vi             text,
  name_id             text,
  name_zh             text,
  desc_en             text,
  desc_vi             text,
  desc_id             text,
  desc_zh             text,
  visibility          text check (visibility in ('Public','Internal','Future')) default 'Internal',
  internal_cat_mapping text check (internal_cat_mapping in ('CAT-A','CAT-B','CAT-C','CAT-D','CAT-E')),
  sort_order          integer default 0,
  art_key             text,
  hero_copy_vi        text,
  seo_title_vi        text,
  seo_description_vi  text,
  status              text check (status in ('Published','Hidden')) default 'Hidden',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_categories_updated_at before update on categories
  for each row execute function set_updated_at();

-- ============================================================
-- 2. scenarios
-- ============================================================
create table scenarios (
  id             uuid primary key default gen_random_uuid(),
  scenario_name  text not null,
  scenario_code  text check (scenario_code in ('S1','S2','S3','S4','S5','S6')),
  slug           text unique,
  priority       integer default 0,
  status         text check (status in ('Primary','Secondary','Supporting','Future','Hidden')) default 'Future',
  name_en        text,
  name_vi        text,
  name_id        text,
  name_zh        text,
  desc_en        text,
  desc_vi        text,
  desc_id        text,
  desc_zh        text,
  pain_point_vi  text,
  proof_needed   text[] default '{}',   -- Vibration / Heat / Magnetic / Durability
  icon           text,
  combo_skus     text,                  -- comma-separated SKU list (matches Notion Text field)
  hero_image_url text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_scenarios_updated_at before update on scenarios
  for each row execute function set_updated_at();

-- ============================================================
-- 3. test_reports  (no product_id column — relation is owned by
--    products.test_reports via the product_test_reports join table,
--    matching the Notion design noted in 後台.md 七之4)
-- ============================================================
create table test_reports (
  id                    uuid primary key default gen_random_uuid(),
  report_name           text not null,
  test_type             text check (test_type in ('Vibration','Heat','Drop','Magnetic Force','Lifecycle','Qi')),
  public_status         text check (public_status in ('Public','Internal Only','Pending')) default 'Pending',
  evidence_level        text check (evidence_level in ('Third-party','Internal Lab','Factory Test','Pending')),
  result_summary_vi     text,
  limitations           text,
  report_file_url       text,
  tested_date           date,
  approved_for_marketing boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger trg_test_reports_updated_at before update on test_reports
  for each row execute function set_updated_at();

-- ============================================================
-- 4. assets
-- ============================================================
create table assets (
  id            uuid primary key default gen_random_uuid(),
  asset_name    text not null,
  asset_type    text check (asset_type in ('Product Image','Lifestyle','Test Graphic','Video','Packaging','Icon')),
  language      text check (language in ('VI','EN','ZH','Universal')) default 'Universal',
  usage_rights  text check (usage_rights in ('Owned','Licensed','KOL','Pending')) default 'Pending',
  status        text check (status in ('Draft','Approved','Needs Retouch','Archived')) default 'Draft',
  file_url      text,
  alt_text_vi   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger trg_assets_updated_at before update on assets
  for each row execute function set_updated_at();

-- ============================================================
-- 5. faq
-- ============================================================
create table faq (
  id             uuid primary key default gen_random_uuid(),
  faq_key        text unique not null,
  question_en    text,
  question_vi    text,
  question_id    text,   -- Indonesian, not a numeric ID (see 後台.md note)
  question_zh    text,
  answer_en      text,
  answer_vi      text,
  answer_id      text,
  answer_zh      text,
  category       text check (category in ('Installation','Compatibility','Warranty','Charging','Heat','Return')),
  status         text check (status in ('Draft','Published','Archived')) default 'Draft',
  last_reviewed  date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_faq_updated_at before update on faq
  for each row execute function set_updated_at();

-- ============================================================
-- 6. guides
-- ============================================================
create table guides (
  id               uuid primary key default gen_random_uuid(),
  article_title    text not null,
  slug             text unique,
  language         text check (language in ('VI','EN','ZH')) default 'VI',
  topic            text check (topic in ('Buying Guide','Installation','Qi2','Comparison','Dealer')),
  funnel_stage     text check (funnel_stage in ('Awareness','Consideration','Conversion','Support')),
  status           text check (status in ('Idea','Draft','Review','Published')) default 'Idea',
  seo_title        text,
  seo_description  text,
  cta              text check (cta in ('Shopee','Product','Dealer','Support')),
  content_body     text,   -- article body (Notion kept this in page body, not a property)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_guides_updated_at before update on guides
  for each row execute function set_updated_at();

-- ============================================================
-- 7. products  (core table — public catalog fields + internal-only
--    pricing/margin/stock fields kept in the SAME table but locked
--    down entirely via RLS + a public-safe view; see rls.sql)
-- ============================================================
create table products (
  id                     uuid primary key default gen_random_uuid(),
  product_id             text unique not null,   -- launch short code, e.g. VMG-B2-Dash
  official_sku_code      text unique,             -- whitepaper 8-char code, e.g. VB002DSH
  slug                   text unique not null,
  status                 text check (status in ('Draft','Review','Published','Hidden','Discontinued')) default 'Draft',
  launch_tier            text check (launch_tier in ('A - Core','B - Test','C - Display','Future')) default 'Future',
  category_id            uuid references categories(id) on delete set null,
  internal_cat           text check (internal_cat in ('CAT-A','CAT-B','CAT-C','CAT-D','CAT-E')),
  persona                text[] default '{}',    -- commuter / homeoffice / traveler / creator
  name_en                text,
  name_vi                text,
  name_id                text,
  name_zh                text,
  claim_en               text,
  claim_vi               text,
  claim_id               text,
  claim_zh               text,
  consumer_pain_point    text[] default '{}',    -- Dropping / Heat / Loose / Compatibility / Cable Mess
  shopee_url             text,
  price_usd              numeric(10,2),
  msrp_usd_min           numeric(10,2),
  msrp_usd_max           numeric(10,2),
  -- ---- internal-only: never selectable by the anon/public role ----
  promo_floor            numeric(4,3),
  target_gross_margin    numeric(4,3),
  minimum_gross_margin   numeric(4,3),
  inventory_first_batch  integer,
  -- ------------------------------------------------------------------
  mount_type             text[] default '{}',    -- Vent / Dashboard / Suction / Tape / Screen / Desktop
  charging_watt          text check (charging_watt in ('None','15W','25W','TBD')) default 'None',
  qi_status              text check (qi_status in ('Not applicable','Compatible','Testing','Certified','Pending')) default 'Not applicable',
  certification_notes    text,
  warranty_months        integer default 12,
  defect_exchange_days   integer default 14,
  hero_image_url         text,
  gallery_urls           text[] default '{}',
  spec_sheet_url         text,
  art_key                text,
  badge                  text check (badge in ('bestseller','new','soon')),
  rating                 numeric(2,1),
  review_count           integer default 0,
  seo_title_vi           text,
  seo_description_vi     text,
  last_reviewed          date,
  owner                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();
create index idx_products_status on products(status);
create index idx_products_category on products(category_id);

-- ---- multi-relations owned by Products (join tables) ----
create table product_scenarios (
  product_id  uuid not null references products(id) on delete cascade,
  scenario_id uuid not null references scenarios(id) on delete cascade,
  primary key (product_id, scenario_id)
);

create table product_test_reports (
  product_id     uuid not null references products(id) on delete cascade,
  test_report_id uuid not null references test_reports(id) on delete cascade,
  primary key (product_id, test_report_id)
);

create table product_faqs (
  product_id uuid not null references products(id) on delete cascade,
  faq_id     uuid not null references faq(id) on delete cascade,
  primary key (product_id, faq_id)
);

create table product_related_products (
  product_id         uuid not null references products(id) on delete cascade,
  related_product_id uuid not null references products(id) on delete cascade,
  primary key (product_id, related_product_id),
  check (product_id <> related_product_id)
);

-- ============================================================
-- 8. dealer_leads  (public form writes via anon INSERT; see rls.sql)
-- ============================================================
create table dealer_leads (
  id                        uuid primary key default gen_random_uuid(),
  company_name              text not null,
  contact_person            text,
  email                     text,
  phone_zalo                text,
  city_region               text,
  channel_type              text[] default '{}',  -- Shopee / Retail / Distributor / Car Accessories / Mobile Accessories
  current_brands            text,
  monthly_sales_estimate    numeric,
  first_order_readiness     text check (first_order_readiness in ('Ready','Need Samples','Just Researching')),
  can_meet_minimum_order    boolean default false,
  needs_regional_protection boolean default false,
  status                    text check (status in ('New','Contacted','Sample Sent','Negotiating','Won','Lost')) default 'New',
  next_follow_up            date,
  notes                     text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create trigger trg_dealer_leads_updated_at before update on dealer_leads
  for each row execute function set_updated_at();

-- ============================================================
-- 9. support_cases  (public form writes via anon INSERT; see rls.sql)
-- ============================================================
create sequence support_case_seq start 1;

create table support_cases (
  id                 uuid primary key default gen_random_uuid(),
  case_id            text unique not null default
                       ('SC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('support_case_seq')::text, 4, '0')),
  customer_name      text,
  contact            text,
  product_reported   text,
  purchase_channel   text check (purchase_channel in ('Shopee','Dealer','Website','Other')),
  purchase_date      date,
  issue_type         text check (issue_type in ('DOA','Heat','Drop','Charging','Mount Loose','Compatibility','Other')),
  issue_description  text,
  warranty_status    text check (warranty_status in ('Within 14 Days','Within 12 Months','Out of Warranty','Unknown')),
  evidence_urls      text[] default '{}',
  resolution         text check (resolution in ('Replace','Guide','Reject','Pending')),
  cost_owner         text check (cost_owner in ('VIEMAG','Customer','Shared','Dealer')),
  status             text check (status in ('New','Reviewing','Resolved','Escalated')) default 'New',
  escalate_to_taiwan boolean default false,
  root_cause         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_support_cases_updated_at before update on support_cases
  for each row execute function set_updated_at();

-- ============================================================
-- 10. site_settings
-- ============================================================
create table site_settings (
  id               uuid primary key default gen_random_uuid(),
  page_name        text not null,
  slug             text,
  page_type        text check (page_type in ('Home','Category','Static','Landing','Support')),
  language         text check (language in ('VI','EN','ZH')) default 'VI',
  status           text check (status in ('Draft','Published','Hidden')) default 'Draft',
  seo_title        text,
  seo_description  text,
  hero_title       text,
  hero_copy        text,
  cta_label        text,
  cta_url          text,
  sort_order       integer default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_site_settings_updated_at before update on site_settings
  for each row execute function set_updated_at();

-- Internal proofreading state, keyed by the full field name (e.g. name_vi).
alter table public.products add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.product_packaging add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.brand_settings add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.categories add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.scenarios add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.test_reports add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.guides add column if not exists translation_locks jsonb not null default '{}'::jsonb;
alter table public.faq add column if not exists translation_locks jsonb not null default '{}'::jsonb;

alter table public.products
  add column if not exists technical_content_en text,
  add column if not exists technical_content_vi text,
  add column if not exists technical_content_id text,
  add column if not exists technical_content_zh text;

comment on column public.products.technical_content_en is
  'Flexible public content for the product Specifications tab: size tables, technical images, diagrams, or extra specs.';
comment on column public.products.technical_content_vi is
  'Vietnamese flexible public content for the product Specifications tab.';
comment on column public.products.technical_content_id is
  'Indonesian flexible public content for the product Specifications tab.';
comment on column public.products.technical_content_zh is
  'Traditional Chinese flexible public content for the product Specifications tab.';

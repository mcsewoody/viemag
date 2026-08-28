-- VIEMAG — product-page article block
--
-- Adds optional long-form product content for PDP pages: one lead image plus
-- localized article body copy. Blank values are safe; the public page simply
-- omits the block.

alter table public.products
  add column if not exists product_article_image_url text,
  add column if not exists product_article_en text,
  add column if not exists product_article_vi text,
  add column if not exists product_article_id text,
  add column if not exists product_article_zh text;

comment on column public.products.product_article_image_url is
  'Optional lead image for the long-form product article section on the product page.';
comment on column public.products.product_article_en is
  'Optional long-form product article body, English. Supports the same simple markdown-like formatting as guides.';
comment on column public.products.product_article_vi is
  'Optional long-form product article body, Vietnamese.';
comment on column public.products.product_article_id is
  'Optional long-form product article body, Indonesian.';
comment on column public.products.product_article_zh is
  'Optional long-form product article body, Traditional Chinese.';

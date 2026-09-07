alter table public.categories
  add column if not exists hero_image_url text;

comment on column public.categories.hero_image_url is
  'Public image used as the large category/product-line illustration on the site. Falls back to art_key when blank.';

alter table public.products
  add column if not exists product_dimensions text;

comment on column public.products.product_dimensions is
  'Physical product size shown in the public Specifications tab. Example: 68 x 48 x 35 mm.';

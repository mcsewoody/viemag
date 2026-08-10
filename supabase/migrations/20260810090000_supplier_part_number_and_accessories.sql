-- Two unrelated fields, one migration (2026-08-10, Woody's request).

-- ---------- 1. supplier_part_number: owner-only, never published ----------
-- The supplier's own code for this item. It sits next to `supplier` on the
-- development tab and inherits that table's owner-only RLS, because a part
-- number is a lookup key into a specific manufacturer's catalogue — publishing
-- it would give away roughly what publishing the supplier name gives away, and
-- the whole point of that wall is that nothing traces the brand back to a
-- manufacturing origin. It is NOT added to any export whitelist.
alter table public.product_development
  add column supplier_part_number text;

comment on column public.product_development.supplier_part_number is
  'Supplier''s own item code. Owner-only, never exported — same reasoning as supplier.';

-- ---------- 2. accessories: four languages, published ----------
-- What ships in the box, one item per line. Four separate columns rather than
-- one, matching every other translatable field in this schema: the site serves
-- five languages and a single column cannot.
--
-- Simplified Chinese is deliberately absent. Content is authored in Traditional
-- (accessories_zh) and zh-Hans is produced at runtime by the T2S table in
-- js/main.js, which is the project-wide rule — Traditional-to-Simplified is the
-- reliable direction, so adding a fifth column here would create a second place
-- to forget to fill in.
alter table public.products
  add column accessories_en text,
  add column accessories_vi text,
  add column accessories_id text,
  add column accessories_zh text;

comment on column public.products.accessories_zh is
  'What is in the box, one item per line. Traditional Chinese; zh-Hans is converted at runtime.';

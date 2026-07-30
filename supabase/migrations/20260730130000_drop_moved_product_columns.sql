-- VIEMAG — the owner-only development/cost wall (step 2 of 2: the drops)
--
-- Runs only AFTER 20260730120000 and after the new /admin has been published.
-- Splitting the change this way is what avoids a broken window: the additive
-- half let the old code keep working while GitHub Pages deployed, and this half
-- removes columns nothing references any more. Doing both at once would leave
-- /admin broken for the length of a Pages deploy whichever order it ran in.
--
-- Verified empty before writing this: 0 of 19 products had a value in any of the
-- three. Nothing is being discarded.
--
--   promo_floor            was already broken — described as a floor PRICE but
--                          typed numeric(4,3), so a $19.90 floor was rejected
--                          outright. Reintroduced as products.map_usd with a
--                          price type in step 1.
--   inventory_first_batch  moved to the owner-only table: a first-batch planning
--                          quantity is project data, and the brand rules list
--                          stock quantities as confidential.
--   certification_notes    moved to the owner-only table: in-progress notes are
--                          exactly what must not reach a customer as a promise.

begin;

alter table public.products
  drop column promo_floor,
  drop column inventory_first_batch,
  drop column certification_notes;

commit;

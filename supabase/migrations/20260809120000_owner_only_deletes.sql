-- Deleting catalogue rows becomes owner-only (2026-08-09, Woody's call).
--
-- Until now every catalogue table carried one "staff full access" policy —
-- `for all to authenticated using (true)` — so any editor could DELETE any row.
-- Deletion here is unrecoverable: there is no trash, no soft-delete column and
-- no snapshot to restore from, and several of these deletes cascade into other
-- tables. An editor needs to write and publish content; nobody needs to be able
-- to erase a product at 6pm with no way back.
--
-- /admin also asks for the account password before deleting, but that dialog is
-- browser-side and is about deliberateness, not permission. THIS is the
-- permission: it holds even if someone calls PostgREST directly.
--
-- SELECT / INSERT / UPDATE are unchanged for editors. Only DELETE moves.

-- ---------- 1. catalogue + join tables ----------
-- The relation join tables are deliberately NOT in this list. Their rows are
-- rewritten delete-then-insert every time a product's scenario or FAQ picker is
-- saved, so gating their DELETE would break ordinary editing for editors while
-- protecting nothing — the parent row they describe is what needs protecting,
-- and it is covered below.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'products', 'categories', 'scenarios', 'test_reports',
    'assets', 'faq', 'guides', 'dealer_leads', 'support_cases'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'staff full access', tbl);

    -- Everything except DELETE, unchanged from before.
    execute format($f$
      create policy staff_select on public.%I
        for select to authenticated using (true)
    $f$, tbl);
    execute format($f$
      create policy staff_insert on public.%I
        for insert to authenticated with check (true)
    $f$, tbl);
    execute format($f$
      create policy staff_update on public.%I
        for update to authenticated using (true) with check (true)
    $f$, tbl);

    -- DELETE: owners only. Same owner test as the product_development wall
    -- (20260730120000) so there is one definition of "owner" in the schema.
    execute format($f$
      create policy owner_delete on public.%I
        for delete to authenticated
        using (exists (select 1 from public.admin_users au
                        where au.user_id = auth.uid() and au.role = 'owner'))
    $f$, tbl);
  end loop;
end $$;

-- ---------- 2. sanity check ----------
-- A typo in the loop above would silently leave a table with NO policies at
-- all, which under RLS denies everything — editors would lose the ability to
-- read the table, and the failure would surface as an empty list rather than as
-- an error. Fail the migration here instead.
do $$
declare
  missing text;
begin
  select string_agg(t, ', ')
    into missing
    from unnest(array[
      'products', 'categories', 'scenarios', 'test_reports',
      'assets', 'faq', 'guides', 'dealer_leads', 'support_cases'
    ]) as t
   where not exists (
     select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = t and p.policyname = 'owner_delete'
   );
  if missing is not null then
    raise exception 'owner_delete policy missing on: %', missing;
  end if;
end $$;

comment on table public.products is
  'Catalogue content. Editors may read, create and update; only owners may delete (20260809120000).';

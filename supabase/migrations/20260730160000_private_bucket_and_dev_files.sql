-- VIEMAG — a private bucket, so the development tab can hold real files
--
-- Woody asked (2026-07-30) for design drawings to be uploaded as multiple files
-- rather than pasted as one link, plus a second area for supplier documents
-- (quotations, catalogues). Both are reasonable asks. Neither can use the
-- existing bucket.
--
-- `viemag-media` is `public = true` with a `to public` select policy, because
-- product photos have to load on viemag.biz without a login. Anything uploaded
-- through the normal image widget is therefore fetchable by URL by anyone. A
-- drawing's title block and a quotation's letterhead routinely name the
-- manufacturer — which the brand rules treat as the highest-priority thing to
-- keep out of public reach. Putting those files in viemag-media would punch a
-- hole straight through the owner-only wall built earlier today: the RLS policy
-- would still protect the URL in the database while the FILE sat open to anyone
-- who had the URL.
--
-- So: a second bucket, private, owners only, read through short-lived signed
-- URLs. The 2026-07-30 decision to use links instead of uploads is superseded,
-- not reversed by accident — links were only preferable while uploads meant a
-- public bucket.

begin;

-- ---------- 1. the private bucket ----------
insert into storage.buckets (id, name, public)
values ('viemag-private', 'viemag-private', false)
on conflict (id) do update set public = false;

-- Every verb is owner-gated, matching product_development's own policy. Note
-- there is deliberately NO `to public` select policy here — that single line is
-- the whole difference from viemag-media.
create policy "owners can read viemag-private"
  on storage.objects for select to authenticated
  using (bucket_id = 'viemag-private'
         and exists (select 1 from public.admin_users au
                     where au.user_id = auth.uid() and au.role = 'owner'));

create policy "owners can upload to viemag-private"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'viemag-private'
              and exists (select 1 from public.admin_users au
                          where au.user_id = auth.uid() and au.role = 'owner'));

create policy "owners can update viemag-private"
  on storage.objects for update to authenticated
  using (bucket_id = 'viemag-private'
         and exists (select 1 from public.admin_users au
                     where au.user_id = auth.uid() and au.role = 'owner'));

create policy "owners can delete from viemag-private"
  on storage.objects for delete to authenticated
  using (bucket_id = 'viemag-private'
         and exists (select 1 from public.admin_users au
                     where au.user_id = auth.uid() and au.role = 'owner'));

-- ---------- 2. the two file columns ----------
-- design_link (text, one URL) becomes design_files (text[], many files), and a
-- second array holds supplier documents. The table is empty, so nothing is lost.
--
-- These store STORAGE PATHS, not URLs — unlike products.hero_image_url and
-- products.gallery_urls, which hold absolute public URLs. A signed URL expires,
-- so storing one would rot; the path is the stable identifier and /admin signs it
-- on demand. Anything reading these columns must sign before use.
alter table public.product_development
  drop column design_link,
  add column design_files    text[],
  add column reference_files text[];

comment on column public.product_development.design_files is
  'Storage PATHS (not URLs) in the private viemag-private bucket. Owners only, read via short-lived signed URLs.';
comment on column public.product_development.reference_files is
  'Storage PATHS in viemag-private for supplier-side documents. Same access rules as design_files.';

commit;

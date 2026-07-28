-- ============================================================
-- VIEMAG Backend — Storage bucket for admin-uploaded media
-- Public bucket: anyone can VIEW (product photos must load on the
-- public website); only authenticated staff can upload/replace/delete.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('viemag-media', 'viemag-media', true)
on conflict (id) do nothing;

create policy "public can view viemag-media"
  on storage.objects for select
  to public
  using (bucket_id = 'viemag-media');

create policy "staff can upload to viemag-media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'viemag-media');

create policy "staff can update viemag-media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'viemag-media');

create policy "staff can delete from viemag-media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'viemag-media');

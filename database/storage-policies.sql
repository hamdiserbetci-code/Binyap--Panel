create policy "dokumanlar_bucket_select_same_firma"
on storage.objects
for select
using (
  bucket_id = 'dokumanlar'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = current_firma_id()::text
);

create policy "dokumanlar_bucket_insert_edit"
on storage.objects
for insert
with check (
  bucket_id = 'dokumanlar'
  and auth.role() = 'authenticated'
  and has_panel_permission('edit')
  and (storage.foldername(name))[1] = current_firma_id()::text
);

create policy "dokumanlar_bucket_update_edit"
on storage.objects
for update
using (
  bucket_id = 'dokumanlar'
  and auth.role() = 'authenticated'
  and has_panel_permission('edit')
  and (storage.foldername(name))[1] = current_firma_id()::text
)
with check (
  bucket_id = 'dokumanlar'
  and has_panel_permission('edit')
  and (storage.foldername(name))[1] = current_firma_id()::text
);

create policy "dokumanlar_bucket_delete_delete"
on storage.objects
for delete
using (
  bucket_id = 'dokumanlar'
  and auth.role() = 'authenticated'
  and has_panel_permission('delete')
  and (storage.foldername(name))[1] = current_firma_id()::text
);

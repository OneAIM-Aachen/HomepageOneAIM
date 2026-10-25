-- ============================================================================
-- OneAIM team portal – file storage
--
-- application-files (private): CVs and other uploads from applicants.
--   Path: uploads/<application id>/<random uuid>/<file name>
--   Applicants may only UPLOAD, and only into an application that is open.
--   Nobody but the team can read, list or delete files (signed URLs in the
--   team area, e.g. the CV button in the network database).
--
-- public-images (public): header images of application pages.
--   Team uploads; everyone can view.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('application-files', 'application-files', false, 10485760,  -- 10 MB
   array[
     'application/pdf',
     'image/png', 'image/jpeg',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation'
   ]),
  ('public-images', 'public-images', true, 5242880,             -- 5 MB
   array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Applicants: upload into an open application's folder only
create policy "applicants upload to open applications"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'application-files'
    and (storage.foldername(name))[1] = 'uploads'
    and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_application_open(((storage.foldername(name))[2])::uuid)
  );

-- Team: read and clean up applicant files
create policy "team reads application files"
  on storage.objects for select to authenticated
  using (bucket_id = 'application-files' and (select public.is_team()));

create policy "team deletes application files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'application-files' and (select public.is_team()));

-- Team: manage header images (reading is public through the bucket)
create policy "team manages public images"
  on storage.objects for all to authenticated
  using (bucket_id = 'public-images' and (select public.is_team()))
  with check (bucket_id = 'public-images' and (select public.is_team()));

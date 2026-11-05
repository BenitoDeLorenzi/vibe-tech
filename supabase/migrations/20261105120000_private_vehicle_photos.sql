-- Existing photos remain in place; only authenticated server reads receive signed URLs.
update storage.buckets
set public = false
where id = 'frota-veiculos';

-- The old public URLs must no longer be used as a source for the UI.
update public.frota_veiculos
set foto_url = null
where foto_url is not null;

-- Fix foto de paciente: el formulario sube a
-- avatars/business-avatars/<business_id>/... pero las políticas de storage
-- solo permitían subir a la carpeta <user_id>/... → toda subida era
-- rechazada por RLS. Se habilita la carpeta business-avatars para los
-- miembros del consultorio (mismo patrón que portal-logos).

CREATE POLICY "Business members can upload business avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'business-avatars'
  AND public.user_belongs_to_business(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Business members can update business avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'business-avatars'
  AND public.user_belongs_to_business(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Business members can delete business avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'business-avatars'
  AND public.user_belongs_to_business(auth.uid(), ((storage.foldername(name))[2])::uuid)
);

-- Política para permitir que cualquier usuario autenticado (incluido super admin en modo visita)
-- pueda subir/actualizar/borrar avatares de pacientes bajo el prefijo business-avatars/
-- El path es business-avatars/{businessId}/{uuid}.{ext} y los archivos son leídos por la
-- política pública existente "Avatars are publicly accessible".

CREATE POLICY "Authenticated can upload business avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'business-avatars'
);

CREATE POLICY "Authenticated can update business avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'business-avatars'
);

CREATE POLICY "Authenticated can delete business avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'business-avatars'
);
-- Fix subida de foto de paciente: el bucket 'avatars' quedó sin política de
-- SELECT en storage.objects (se perdió en algún momento; en mayo existía y
-- las fotos se subían bien). El upload de storage hace INSERT ... RETURNING,
-- y bajo RLS la fila devuelta también debe pasar una política de SELECT: sin
-- ella, Postgres corta con "new row violates row-level security policy"
-- aunque el INSERT en sí esté permitido. Nadie lo notó en la lectura porque
-- el bucket es público y las fotos se sirven sin pasar por RLS.

DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

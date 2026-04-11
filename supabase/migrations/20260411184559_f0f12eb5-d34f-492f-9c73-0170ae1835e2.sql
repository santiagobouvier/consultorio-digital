-- Allow authenticated users to upload portal logos
CREATE POLICY "Users can upload portal logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'portal-logos'
);

-- Allow authenticated users to update portal logos
CREATE POLICY "Users can update portal logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'portal-logos'
);

-- Allow authenticated users to delete portal logos
CREATE POLICY "Users can delete portal logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'portal-logos'
);
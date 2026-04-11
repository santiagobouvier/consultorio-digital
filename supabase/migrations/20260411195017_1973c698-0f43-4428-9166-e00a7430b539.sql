
-- Allow public read of business branding fields by public_slug (for clinic portal login screen)
CREATE POLICY "Public can read business branding by slug"
ON public.businesses
FOR SELECT
TO public
USING (true);

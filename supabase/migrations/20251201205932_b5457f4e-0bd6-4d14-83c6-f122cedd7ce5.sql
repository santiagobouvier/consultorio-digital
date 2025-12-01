-- Enable Row Level Security on businesses table
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners can view their own businesses
CREATE POLICY "businesses_select_own"
ON public.businesses
FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Policy: Users can create businesses with themselves as owner
CREATE POLICY "businesses_insert_own"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (owner_user_id = auth.uid());

-- Policy: Business owners can update their own businesses
CREATE POLICY "businesses_update_own"
ON public.businesses
FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Policy: Business owners can delete their own businesses
CREATE POLICY "businesses_delete_own"
ON public.businesses
FOR DELETE
TO authenticated
USING (owner_user_id = auth.uid());
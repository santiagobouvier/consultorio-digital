-- Add RLS policies for services table
CREATE POLICY "Business owners can manage their services"
ON public.services
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.id = services.business_id 
    AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b 
    WHERE b.id = services.business_id 
    AND b.owner_user_id = auth.uid()
  )
);

-- Add RLS policies for profiles table
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());
-- 1. Agregar columna business_id (nullable inicialmente para backfill)
ALTER TABLE public.appointment_requests
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

-- 2. Backfill: asociar solicitudes existentes al business cuyo owner_user_id = clinic_user_id
UPDATE public.appointment_requests ar
SET business_id = b.id
FROM public.businesses b
WHERE ar.business_id IS NULL
  AND b.owner_user_id = ar.clinic_user_id;

-- 3. Borrar solicitudes huérfanas (clinic_user_id no corresponde a ningún owner)
DELETE FROM public.appointment_requests WHERE business_id IS NULL;

-- 4. Hacer la columna NOT NULL
ALTER TABLE public.appointment_requests
  ALTER COLUMN business_id SET NOT NULL;

-- 5. Índice para queries por business_id
CREATE INDEX IF NOT EXISTS idx_appointment_requests_business_id
  ON public.appointment_requests(business_id);

-- 6. Reemplazar RLS policies para usar user_belongs_to_business
DROP POLICY IF EXISTS "Anyone can create appointment requests" ON public.appointment_requests;
DROP POLICY IF EXISTS "Clinic owners can delete their appointment requests" ON public.appointment_requests;
DROP POLICY IF EXISTS "Clinic owners can update their appointment requests" ON public.appointment_requests;
DROP POLICY IF EXISTS "Clinic owners or superadmin can view appointment requests" ON public.appointment_requests;

CREATE POLICY "Anyone can create appointment requests"
ON public.appointment_requests
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Business members can view appointment requests"
ON public.appointment_requests
FOR SELECT
TO public
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can update appointment requests"
ON public.appointment_requests
FOR UPDATE
TO public
USING (public.user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can delete appointment requests"
ON public.appointment_requests
FOR DELETE
TO public
USING (public.user_belongs_to_business(auth.uid(), business_id));
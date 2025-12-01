-- Agregar columnas faltantes a appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS modality text,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pendiente';

-- Renombrar columnas para usar nombres consistentes
ALTER TABLE public.appointments 
RENAME COLUMN start_datetime TO start_at;

ALTER TABLE public.appointments 
RENAME COLUMN end_datetime TO end_at;

ALTER TABLE public.appointments 
RENAME COLUMN notes_internal TO notes;

-- Crear policies para appointments
CREATE POLICY appointments_select_own_business
ON public.appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = appointments.business_id
      AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY appointments_insert_own_business
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = appointments.business_id
      AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY appointments_update_own_business
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = appointments.business_id
      AND b.owner_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = appointments.business_id
      AND b.owner_user_id = auth.uid()
  )
);

CREATE POLICY appointments_delete_own_business
ON public.appointments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = appointments.business_id
      AND b.owner_user_id = auth.uid()
  )
);
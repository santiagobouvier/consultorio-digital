-- Create availability_slots table
CREATE TABLE public.availability_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  modality TEXT NOT NULL,
  price NUMERIC,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT availability_slots_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.availability_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Business owners can view their own slots
CREATE POLICY "Business owners can view their availability slots"
ON public.availability_slots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = availability_slots.business_id
    AND b.owner_user_id = auth.uid()
  )
);

-- Policy: Business owners can insert their own slots
CREATE POLICY "Business owners can create availability slots"
ON public.availability_slots
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = availability_slots.business_id
    AND b.owner_user_id = auth.uid()
  )
);

-- Policy: Business owners can update their own slots
CREATE POLICY "Business owners can update availability slots"
ON public.availability_slots
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = availability_slots.business_id
    AND b.owner_user_id = auth.uid()
  )
);

-- Policy: Business owners can delete their own slots
CREATE POLICY "Business owners can delete availability slots"
ON public.availability_slots
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = availability_slots.business_id
    AND b.owner_user_id = auth.uid()
  )
);

-- Policy: Public can view available slots (for public booking page)
CREATE POLICY "Public can view available slots"
ON public.availability_slots
FOR SELECT
USING (status = 'available' AND date >= CURRENT_DATE);

-- Add trigger for updated_at
CREATE TRIGGER update_availability_slots_updated_at
BEFORE UPDATE ON public.availability_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add column to appointments to reference availability_slot
ALTER TABLE public.appointments
ADD COLUMN availability_slot_id UUID REFERENCES public.availability_slots(id) ON DELETE SET NULL;
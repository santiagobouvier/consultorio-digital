-- Add avatar_url column to patients table
ALTER TABLE public.patients
ADD COLUMN avatar_url text;
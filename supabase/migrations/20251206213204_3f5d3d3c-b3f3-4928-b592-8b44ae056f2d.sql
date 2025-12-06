-- Add recurrence fields to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS recurrence_type text NOT NULL DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS anchor_day integer;

-- Add check constraint for valid recurrence types
ALTER TABLE public.payments 
ADD CONSTRAINT payments_recurrence_type_check 
CHECK (recurrence_type IN ('one_time', 'monthly', 'yearly'));
-- Create payments table for tracking patient payments and due dates
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  appointment_id uuid NULL,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'UYU',
  due_date timestamp with time zone NOT NULL,
  paid_at timestamp with time zone NULL,
  status text NOT NULL DEFAULT 'pending',
  method text NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Add constraint for valid status values
  CONSTRAINT payments_status_check CHECK (status IN ('pending', 'due_soon', 'overdue', 'paid', 'cancelled'))
);

-- Enable Row Level Security
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for payments (business owners only)
CREATE POLICY "payments_select_own_business" 
ON public.payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM businesses b 
  WHERE b.id = payments.business_id 
  AND b.owner_user_id = auth.uid()
));

CREATE POLICY "payments_insert_own_business" 
ON public.payments 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM businesses b 
  WHERE b.id = payments.business_id 
  AND b.owner_user_id = auth.uid()
));

CREATE POLICY "payments_update_own_business" 
ON public.payments 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM businesses b 
  WHERE b.id = payments.business_id 
  AND b.owner_user_id = auth.uid()
));

CREATE POLICY "payments_delete_own_business" 
ON public.payments 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM businesses b 
  WHERE b.id = payments.business_id 
  AND b.owner_user_id = auth.uid()
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for common queries
CREATE INDEX idx_payments_business_id ON public.payments(business_id);
CREATE INDEX idx_payments_patient_id ON public.payments(patient_id);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_due_date ON public.payments(due_date);
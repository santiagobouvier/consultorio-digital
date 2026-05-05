
-- Enum for policy type
CREATE TYPE public.payment_policy_type AS ENUM ('none', 'optional', 'required');

-- Enum for patient override
CREATE TYPE public.patient_payment_override AS ENUM ('inherit', 'none', 'optional', 'required');

-- payment_policies table
CREATE TABLE public.payment_policies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  policy_type public.payment_policy_type NOT NULL DEFAULT 'none',
  deposit_percentage INTEGER CHECK (deposit_percentage IS NULL OR (deposit_percentage >= 0 AND deposit_percentage <= 100)),
  session_price INTEGER NOT NULL DEFAULT 0,
  mp_access_token TEXT,
  mp_public_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

ALTER TABLE public.payment_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view payment policies"
ON public.payment_policies FOR SELECT
USING (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can insert payment policies"
ON public.payment_policies FOR INSERT
WITH CHECK (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can update payment policies"
ON public.payment_policies FOR UPDATE
USING (user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Business members can delete payment policies"
ON public.payment_policies FOR DELETE
USING (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "Super admin full access payment policies"
ON public.payment_policies FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_payment_policies_updated_at
BEFORE UPDATE ON public.payment_policies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add override column to patients
ALTER TABLE public.patients
ADD COLUMN payment_policy_override public.patient_payment_override NOT NULL DEFAULT 'inherit';

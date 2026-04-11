
-- Create subscription status type
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'trial',
  billing_period text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UYU',
  
  -- Mercado Pago references
  mercadopago_preapproval_id text,
  mercadopago_payer_id text,
  
  -- Trial
  trial_ends_at timestamp with time zone,
  
  -- Billing cycle
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  
  -- Lifecycle
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN ('trial', 'active', 'past_due', 'cancelled', 'expired')),
  CONSTRAINT valid_billing_period CHECK (billing_period IN ('monthly', 'annual'))
);

-- Index for quick lookups
CREATE INDEX idx_subscriptions_business_id ON public.subscriptions(business_id);
CREATE INDEX idx_subscriptions_mercadopago_id ON public.subscriptions(mercadopago_preapproval_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Business owners can view their own subscription
CREATE POLICY "Business owners can view their subscription"
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = subscriptions.business_id
    AND b.owner_user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

-- Business owners can update their subscription (limited fields)
CREATE POLICY "Business owners can update their subscription"
ON public.subscriptions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = subscriptions.business_id
    AND b.owner_user_id = auth.uid()
  )
  OR public.is_super_admin(auth.uid())
);

-- Only service role / edge functions can insert (no direct user inserts)
CREATE POLICY "Service role can insert subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin can delete
CREATE POLICY "Super admin can delete subscriptions"
ON public.subscriptions
FOR DELETE
USING (public.is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

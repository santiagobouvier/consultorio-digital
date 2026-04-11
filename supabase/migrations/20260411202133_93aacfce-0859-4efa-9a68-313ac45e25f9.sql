
-- Function to auto-create trial subscription
CREATE OR REPLACE FUNCTION public.create_trial_subscription_on_business()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip demo businesses
  IF NEW.is_demo = true THEN
    RETURN NEW;
  END IF;

  -- Insert trial subscription
  INSERT INTO public.subscriptions (
    business_id,
    plan_code,
    status,
    billing_period,
    amount,
    currency,
    trial_ends_at,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    NEW.plan_code,
    'trial',
    NEW.billing_period,
    0,
    'UYU',
    now() + interval '7 days',
    now(),
    now() + interval '7 days'
  );

  RETURN NEW;
END;
$$;

-- Trigger on business creation
CREATE TRIGGER trg_create_trial_subscription
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.create_trial_subscription_on_business();

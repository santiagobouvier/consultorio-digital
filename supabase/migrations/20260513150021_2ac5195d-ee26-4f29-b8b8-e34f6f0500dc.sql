CREATE OR REPLACE FUNCTION public.create_trial_subscription_on_business()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_demo = true THEN
    RETURN NEW;
  END IF;

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
    now() + interval '30 days',
    now(),
    now() + interval '30 days'
  );

  RETURN NEW;
END;
$function$;
-- Esquema mínimo que imita lo relevante de producción (Supabase) para probar
-- la migración de planes manuales. SOLO para un Postgres desechable.
--
-- Refleja lo confirmado en producción con consultas de solo lectura:
--   * authenticated tiene UPDATE/INSERT en las columnas comerciales;
--   * RLS activa con políticas de dueño, sin restricción de valores;
--   * sin reglas; en businesses solo el trigger AFTER INSERT de alta; en
--     subscriptions solo updated_at;
--   * el alta da 30 días de prueba y omite la suscripción si is_demo = true.

-- Roles de la API de Supabase
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- auth.uid() igual que en Supabase (lee el claim "sub" del JWT de la request)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  business_id uuid,
  role text NOT NULL
);

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  public_slug text,
  plan_code text NOT NULL DEFAULT 'individual',
  billing_period text DEFAULT 'annual',
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  no_billing_until date,
  custom_max_patients integer,
  custom_max_professionals integer,
  plan_started_at timestamptz,
  onboarding_completed boolean DEFAULT false
);

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_code text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'trial',
  billing_period text NOT NULL DEFAULT 'monthly',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'UYU',
  mercadopago_preapproval_id text,
  mercadopago_payer_id text,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas de businesses (repo: 20251208044331 y anteriores)
CREATE POLICY "Business owners and super admin can view"
  ON public.businesses FOR SELECT
  USING (public.is_super_admin(auth.uid()) OR owner_user_id = auth.uid());
CREATE POLICY "Users can create their own business"
  ON public.businesses FOR INSERT
  WITH CHECK (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));
CREATE POLICY "Owners can update their business"
  ON public.businesses FOR UPDATE
  USING (owner_user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() OR is_super_admin(auth.uid()));

-- Políticas de subscriptions (repo: 20260411164400)
CREATE POLICY "Business owners can view their subscription"
  ON public.subscriptions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_user_id = auth.uid())
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "Business owners can update their subscription"
  ON public.subscriptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_user_id = auth.uid())
         OR public.is_super_admin(auth.uid()));
CREATE POLICY "Service role can insert subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT USING (user_id = auth.uid());

-- updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de alta, tal cual el vigente (repo 20260513150021): 30 días, sin suscripción si is_demo
CREATE OR REPLACE FUNCTION public.create_trial_subscription_on_business()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_demo = true THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.subscriptions (
    business_id, plan_code, status, billing_period, amount, currency,
    trial_ends_at, current_period_start, current_period_end
  ) VALUES (
    NEW.id, NEW.plan_code, 'trial', NEW.billing_period, 0, 'UYU',
    now() + interval '30 days', now(), now() + interval '30 days'
  );
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_create_trial_subscription AFTER INSERT ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.create_trial_subscription_on_business();

-- Réplica de lo que hace el webhook de Mercado Pago con un evento de débito:
-- busca la suscripción por preapproval_id y, si la encuentra, la actualiza.
-- (supabase/functions/mercadopago-webhook/index.ts: ramas subscription_preapproval
-- y pago con metadata.preapproval_id.)
CREATE OR REPLACE FUNCTION public.test_simular_webhook_mp(
  p_preapproval_id text, p_nuevo_estado text, p_plan_ref text
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_sub record;
BEGIN
  SELECT id, business_id INTO v_sub FROM public.subscriptions
  WHERE mercadopago_preapproval_id = p_preapproval_id;
  IF NOT FOUND THEN
    RETURN 0; -- "Subscription not found for preapproval": responde 200 y no toca nada
  END IF;
  UPDATE public.subscriptions
  SET status = p_nuevo_estado,
      plan_code = p_plan_ref,
      current_period_start = now(),
      current_period_end = now() + interval '1 year',
      cancelled_at = CASE WHEN p_nuevo_estado = 'cancelled' THEN now() ELSE NULL END
  WHERE id = v_sub.id;
  IF p_nuevo_estado = 'active' THEN
    UPDATE public.businesses SET is_active = true, plan_code = p_plan_ref, plan_started_at = now()
    WHERE id = v_sub.business_id;
  ELSE
    UPDATE public.businesses SET is_active = false WHERE id = v_sub.business_id;
  END IF;
  RETURN 1;
END;
$$;

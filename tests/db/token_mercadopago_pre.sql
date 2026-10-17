-- Esquema extra para token_mercadopago_test.sql: payment_policies tal como la
-- crea el repo (20260505220007) con sus políticas RLS de miembros, y el
-- helper user_belongs_to_business.
CREATE OR REPLACE FUNCTION public.user_belongs_to_business(_user_id uuid, _business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.businesses WHERE id = _business_id AND owner_user_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND business_id = _business_id)
      OR public.is_super_admin(_user_id)
$$;

DO $$ BEGIN CREATE TYPE public.payment_policy_type AS ENUM ('none', 'optional', 'required');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.payment_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  policy_type public.payment_policy_type NOT NULL DEFAULT 'none',
  deposit_percentage integer,
  session_price integer NOT NULL DEFAULT 0,
  mp_access_token text,
  mp_public_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);
-- Como en Supabase: privilegios amplios por defecto, el control lo hace RLS
GRANT ALL ON public.payment_policies TO anon, authenticated, service_role;
ALTER TABLE public.payment_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Business members can view payment policies" ON public.payment_policies FOR SELECT
  USING (user_belongs_to_business(auth.uid(), business_id));
CREATE POLICY "Business members can insert payment policies" ON public.payment_policies FOR INSERT
  WITH CHECK (user_belongs_to_business(auth.uid(), business_id));
CREATE POLICY "Business members can update payment policies" ON public.payment_policies FOR UPDATE
  USING (user_belongs_to_business(auth.uid(), business_id))
  WITH CHECK (user_belongs_to_business(auth.uid(), business_id));

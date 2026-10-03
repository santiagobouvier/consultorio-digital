-- CD-005 · Planes y suscripciones: gestión manual desde el superadmin y
-- bloqueo del cliente.
--
-- Qué hace:
--   1) El cliente (dueño logueado) ya no puede cambiar su plan, estado,
--      vencimiento ni "Sin cobro": ni en `businesses` ni en `subscriptions`.
--      Las pantallas de configuración del consultorio siguen funcionando
--      porque no tocan esas columnas.
--   2) En el alta de un consultorio hecha por el propio cliente se descartan
--      "Sin cobro", límites a medida y planes no públicos. El trigger de alta
--      (prueba de 30 días, y sin suscripción si is_demo) NO se modifica.
--   3) Cuando el superadmin cambia a mano plan/estado/vencimiento/Sin cobro,
--      la suscripción queda "gestionada a mano": se desengancha el débito de
--      Mercado Pago que tuviera (el id pasa a detached_mercadopago_preapproval_id).
--      Así, una renovación o cancelación vieja de ese débito ya no encuentra la
--      suscripción y no puede revertir lo que decidió el admin. El débito NO se
--      cancela en Mercado Pago: eso lo decide el admin en Mercado Pago.
--   4) La política de UPDATE de `subscriptions` pasa a ser solo del superadmin.
--
-- Quién sigue pudiendo escribir todo, sin cambios:
--   * service_role: webhook de Mercado Pago, create-subscription,
--     cancel-subscription, alta y activación de consultorios.
--   * postgres: triggers SECURITY DEFINER (alta), cron y editor SQL.
--   * superadmin desde el panel.
--
-- Idempotente: se puede aplicar más de una vez.

-- ── 0) Rastro del débito desenganchado ──
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS detached_mercadopago_preapproval_id text;

COMMENT ON COLUMN public.subscriptions.detached_mercadopago_preapproval_id IS
  'Débito de Mercado Pago que tenía la suscripción cuando el superadmin pasó a gestionarla a mano. Solo referencia: la app ya no lo sigue y no lo canceló en Mercado Pago.';

-- ── 1) businesses: columnas comerciales ──
CREATE OR REPLACE FUNCTION public.protect_business_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cols text[] := ARRAY[
    'plan_code', 'billing_period', 'is_demo', 'no_billing_until',
    'custom_max_patients', 'custom_max_professionals', 'is_active', 'plan_started_at'
  ];
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb;
  v_changed text[];
BEGIN
  -- Backend (edge functions, triggers internos, cron, editor SQL)
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    SELECT array_agg(c) INTO v_changed
    FROM unnest(v_cols) AS c
    WHERE v_new -> c IS DISTINCT FROM v_old -> c;
  END IF;

  -- Superadmin: puede todo. Si cambió algo comercial, la suscripción pasa a
  -- gestión manual (ver trigger de subscriptions).
  IF public.is_super_admin(auth.uid()) THEN
    IF v_changed IS NOT NULL THEN
      UPDATE public.subscriptions
      SET mercadopago_preapproval_id = NULL
      WHERE business_id = NEW.id AND mercadopago_preapproval_id IS NOT NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Cliente: alta → se descartan valores comerciales que no le corresponden.
  IF TG_OP = 'INSERT' THEN
    NEW := jsonb_populate_record(
      NEW,
      jsonb_build_object(
        'is_demo', false,
        'no_billing_until', NULL,
        'custom_max_patients', NULL,
        'custom_max_professionals', NULL,
        'plan_started_at', NULL
      )
      || CASE
           WHEN coalesce(v_new ->> 'plan_code', '') IN (
             'emprendedor', 'esencial', 'profesional',
             'starter', 'individual', 'inicial', 'professional'
           ) THEN '{}'::jsonb
           ELSE jsonb_build_object('plan_code', 'emprendedor')
         END
    );
    RETURN NEW;
  END IF;

  -- Cliente: edición → rechazar cambios comerciales.
  IF v_changed IS NOT NULL THEN
    RAISE EXCEPTION 'plan_change_not_allowed'
      USING ERRCODE = '42501',
            DETAIL = 'Columnas: ' || array_to_string(v_changed, ', '),
            HINT = 'Los cambios de plan, acceso o cobro los gestiona soporte.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_business_billing ON public.businesses;
CREATE TRIGGER trg_protect_business_billing
  BEFORE INSERT OR UPDATE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_business_billing_columns();

-- ── 2) subscriptions: solo backend y superadmin ──
CREATE OR REPLACE FUNCTION public.protect_subscription_billing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ignore text[] := ARRAY['updated_at', 'mercadopago_preapproval_id', 'detached_mercadopago_preapproval_id'];
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF public.is_super_admin(auth.uid()) THEN
    -- Gestión manual: cualquier cambio del admin sobre una suscripción con
    -- débito de Mercado Pago la desengancha de ese débito.
    IF TG_OP = 'UPDATE'
       AND OLD.mercadopago_preapproval_id IS NOT NULL
       AND (
         NEW.mercadopago_preapproval_id IS NULL
         OR (to_jsonb(NEW) - v_ignore) IS DISTINCT FROM (to_jsonb(OLD) - v_ignore)
       )
    THEN
      NEW.detached_mercadopago_preapproval_id := OLD.mercadopago_preapproval_id;
      NEW.mercadopago_preapproval_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- Cliente: nunca escribe su suscripción (además de la política RLS).
  IF TG_OP = 'INSERT'
     OR (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at')
  THEN
    RAISE EXCEPTION 'subscription_change_not_allowed'
      USING ERRCODE = '42501',
            HINT = 'Los cambios de plan, acceso o cobro los gestiona soporte.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_subscription_billing ON public.subscriptions;
CREATE TRIGGER trg_protect_subscription_billing
  BEFORE INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_subscription_billing();

-- ── 3) Política: el dueño deja de poder actualizar su suscripción ──
DROP POLICY IF EXISTS "Business owners can update their subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Super admin can update subscriptions" ON public.subscriptions;
CREATE POLICY "Super admin can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

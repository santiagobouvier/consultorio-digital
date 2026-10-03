-- Pruebas de la migración 20261003120000_planes_gestion_manual.sql.
-- Correr con tests/db/run.sh contra un Postgres DESECHABLE (nunca producción).
-- Cada caso imprime "OK: …"; cualquier falla corta con "FALLA: …".
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
SET client_min_messages = notice;

CREATE OR REPLACE FUNCTION public.test_ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'FALLA: %', msg; END IF;
  RAISE NOTICE 'OK: %', msg;
END $$;

-- ── Datos ficticios (como postgres, igual que el backend) ──
-- Usuarios
--   admin            aaaaaaaa-0000-4000-8000-000000000001  (super_admin)
--   cliente manual   aaaaaaaa-0000-4000-8000-000000000002  consultorio con débito MP viejo
--   cliente MP       aaaaaaaa-0000-4000-8000-000000000003  paga por la plataforma (no se toca)
--   cliente cortesía aaaaaaaa-0000-4000-8000-000000000004  con débito MP viejo
--   cliente nuevo    aaaaaaaa-0000-4000-8000-000000000005  se da de alta solo
INSERT INTO public.user_roles (user_id, role) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'super_admin');

INSERT INTO public.businesses (id, owner_user_id, name, plan_code) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', 'QA Manual', 'emprendedor'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000003', 'QA Plataforma', 'esencial'),
  ('bbbbbbbb-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000004', 'QA Cortesia', 'emprendedor');

UPDATE public.subscriptions SET status = 'active', amount = 1290, mercadopago_preapproval_id = 'mp-viejo-2',
  current_period_end = now() + interval '200 days'
WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000002';
UPDATE public.subscriptions SET status = 'active', amount = 2400, mercadopago_preapproval_id = 'mp-plataforma-3',
  current_period_end = now() + interval '100 days'
WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000003';
UPDATE public.subscriptions SET status = 'active', amount = 1290, mercadopago_preapproval_id = 'mp-viejo-4',
  current_period_end = now() + interval '50 days'
WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000004';

-- ════════════════ 1) El cliente NO puede autoasignarse nada ════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002"}', false);

DO $$
DECLARE
  v_intentos text[][] := ARRAY[
    ARRAY['plan_code', $q$UPDATE public.businesses SET plan_code = 'personalizado' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['is_demo (Sin cobro)', $q$UPDATE public.businesses SET is_demo = true WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['no_billing_until', $q$UPDATE public.businesses SET no_billing_until = '2099-01-01' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['custom_max_patients', $q$UPDATE public.businesses SET custom_max_patients = 9999 WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['custom_max_professionals', $q$UPDATE public.businesses SET custom_max_professionals = 99 WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['is_active', $q$UPDATE public.businesses SET is_active = false WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['billing_period', $q$UPDATE public.businesses SET billing_period = 'monthly' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$],
    ARRAY['plan_started_at', $q$UPDATE public.businesses SET plan_started_at = now() WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002'$q$]
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(v_intentos, 1) LOOP
    BEGIN
      EXECUTE v_intentos[i][2];
      RAISE EXCEPTION 'FALLA: el cliente pudo cambiar businesses.%', v_intentos[i][1];
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'OK: cliente bloqueado al cambiar businesses.%', v_intentos[i][1];
    END;
  END LOOP;
END $$;

-- La configuración normal del consultorio sigue funcionando (y mandar el plan sin cambiarlo no molesta)
UPDATE public.businesses SET name = 'QA Manual (renombrado)', contact_email = 'qa@example.test', plan_code = 'emprendedor'
WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002';

-- Suscripción: sin política de dueño, el UPDATE no alcanza ninguna fila
UPDATE public.subscriptions SET status = 'active', plan_code = 'profesional', trial_ends_at = '2099-01-01', current_period_end = '2099-01-01'
WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000002';
RESET ROLE;

SELECT public.test_ok((SELECT name FROM public.businesses WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002') = 'QA Manual (renombrado)',
  'el cliente sigue pudiendo editar nombre y email de su consultorio');
SELECT public.test_ok((SELECT plan_code = 'emprendedor' AND current_period_end < now() + interval '201 days'
                       FROM public.subscriptions WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'el cliente no pudo cambiar plan ni vencimiento de su suscripción');

-- Defensa extra: aunque en producción quedara una política de dueño con otro nombre, el trigger lo frena
CREATE POLICY "politica vieja con otro nombre" ON public.subscriptions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_user_id = auth.uid()));
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002"}', false);
DO $$
BEGIN
  UPDATE public.subscriptions SET status = 'active', trial_ends_at = '2099-01-01'
  WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000002';
  RAISE EXCEPTION 'FALLA: el cliente pudo escribir su suscripción con una política vieja';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'OK: con una política de dueño residual, el trigger igual bloquea al cliente';
END $$;
RESET ROLE;
DROP POLICY "politica vieja con otro nombre" ON public.subscriptions;

-- ════════════════ 2) Alta hecha por el propio cliente ════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000005"}', false);
INSERT INTO public.businesses (id, owner_user_id, name, plan_code, is_demo, no_billing_until, custom_max_patients, custom_max_professionals)
VALUES ('bbbbbbbb-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000005', 'QA Alta tramposa', 'personalizado', true, '2099-01-01', 9999, 99);
INSERT INTO public.businesses (id, owner_user_id, name, plan_code)
VALUES ('bbbbbbbb-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000005', 'QA Alta normal', 'esencial');
RESET ROLE;

SELECT public.test_ok((SELECT NOT is_demo AND no_billing_until IS NULL AND custom_max_patients IS NULL
                              AND custom_max_professionals IS NULL AND plan_code = 'emprendedor'
                       FROM public.businesses WHERE id = 'bbbbbbbb-0000-4000-8000-000000000005'),
  'alta del cliente: se descartan Sin cobro, límites a medida y plan no público');
SELECT public.test_ok((SELECT status = 'trial' AND trial_ends_at > now() + interval '29 days' AND trial_ends_at < now() + interval '31 days'
                       FROM public.subscriptions WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000005'),
  'alta del cliente: el trigger de alta sigue creando la prueba de 30 días');
SELECT public.test_ok((SELECT b.plan_code = 'esencial' AND s.plan_code = 'esencial' AND s.status = 'trial'
                       FROM public.businesses b JOIN public.subscriptions s ON s.business_id = b.id
                       WHERE b.id = 'bbbbbbbb-0000-4000-8000-000000000006'),
  'alta normal con plan público: se respeta el plan elegido para la prueba');

-- El alta del backend (service_role) no se toca: is_demo = true sigue sin crear suscripción
SET ROLE service_role;
INSERT INTO public.businesses (id, owner_user_id, name, is_demo)
VALUES ('bbbbbbbb-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'QA Demo backend', true);
RESET ROLE;
SELECT public.test_ok((SELECT is_demo FROM public.businesses WHERE id = 'bbbbbbbb-0000-4000-8000-000000000007')
                      AND NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000007'),
  'alta del backend con is_demo: sigue sin suscripción (lógica de alta intacta)');

-- ════════════════ 3) Superadmin: cobro externo ════════════════
-- Lo mismo que hace "Activar suscripción → Cuenta activa · cobro por fuera" del panel
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
UPDATE public.subscriptions
SET status = 'active', plan_code = 'profesional', billing_period = 'annual', amount = 4500,
    trial_ends_at = NULL, current_period_start = now(), current_period_end = '2027-10-03', cancelled_at = NULL
WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000002';
UPDATE public.businesses SET is_active = true, plan_code = 'profesional'
WHERE id = 'bbbbbbbb-0000-4000-8000-000000000002';
RESET ROLE;

SELECT public.test_ok((SELECT s.status = 'active' AND s.plan_code = 'profesional' AND b.plan_code = 'profesional'
                              AND s.amount = 4500 AND s.current_period_end::date = '2027-10-03'
                       FROM public.subscriptions s JOIN public.businesses b ON b.id = s.business_id
                       WHERE b.id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'superadmin asigna plan y acceso con cobro externo, sin checkout');
SELECT public.test_ok((SELECT mercadopago_preapproval_id IS NULL AND detached_mercadopago_preapproval_id = 'mp-viejo-2'
                       FROM public.subscriptions WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'gestión manual: el débito viejo de MP queda desenganchado y registrado');

-- Eventos viejos de Mercado Pago (como service_role, igual que el webhook)
SET ROLE service_role;
SELECT public.test_ok(public.test_simular_webhook_mp('mp-viejo-2', 'active', 'emprendedor') = 0,
  'renovación vieja de MP: no encuentra la suscripción manual');
SELECT public.test_ok(public.test_simular_webhook_mp('mp-viejo-2', 'cancelled', 'emprendedor') = 0,
  'cancelación vieja de MP: no encuentra la suscripción manual');
RESET ROLE;
SELECT public.test_ok((SELECT s.status = 'active' AND s.plan_code = 'profesional' AND b.plan_code = 'profesional' AND b.is_active
                       FROM public.subscriptions s JOIN public.businesses b ON b.id = s.business_id
                       WHERE b.id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  'el plan y el acceso manuales no se revierten por eventos viejos de MP');

-- ════════════════ 4) Superadmin: cortesía (Sin cobro) ════════════════
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
UPDATE public.businesses SET name = 'QA Cortesia (solo nombre)' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000004';
RESET ROLE;
SELECT public.test_ok((SELECT mercadopago_preapproval_id = 'mp-viejo-4' FROM public.subscriptions
                       WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000004'),
  'si el admin solo cambia el nombre, el débito MP no se desengancha');

SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001"}', false);
UPDATE public.businesses SET is_demo = true, no_billing_until = '2027-01-01' WHERE id = 'bbbbbbbb-0000-4000-8000-000000000004';
RESET ROLE;
SELECT public.test_ok((SELECT b.is_demo AND b.no_billing_until = '2027-01-01'
                              AND s.mercadopago_preapproval_id IS NULL AND s.detached_mercadopago_preapproval_id = 'mp-viejo-4'
                       FROM public.businesses b JOIN public.subscriptions s ON s.business_id = b.id
                       WHERE b.id = 'bbbbbbbb-0000-4000-8000-000000000004'),
  'superadmin concede cortesía (Sin cobro) y el débito viejo se desengancha');
SET ROLE service_role;
SELECT public.test_ok(public.test_simular_webhook_mp('mp-viejo-4', 'cancelled', 'emprendedor') = 0,
  'cancelación vieja de MP no apaga al consultorio en cortesía');
RESET ROLE;
SELECT public.test_ok((SELECT is_active FROM public.businesses WHERE id = 'bbbbbbbb-0000-4000-8000-000000000004'),
  'el consultorio en cortesía sigue activo');

-- ════════════════ 5) Pagos por la plataforma: se conservan ════════════════
SET ROLE service_role;
SELECT public.test_ok(public.test_simular_webhook_mp('mp-plataforma-3', 'active', 'esencial') = 1,
  'renovación de un cliente que paga por la plataforma: el webhook la encuentra');
-- create-subscription de un cliente (service_role): débito nuevo
UPDATE public.subscriptions SET mercadopago_preapproval_id = 'mp-nuevo-5', status = 'pending', plan_code = 'esencial'
WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000006';
RESET ROLE;
SELECT public.test_ok((SELECT s.status = 'active' AND s.mercadopago_preapproval_id = 'mp-plataforma-3'
                              AND s.detached_mercadopago_preapproval_id IS NULL AND b.is_active
                       FROM public.subscriptions s JOIN public.businesses b ON b.id = s.business_id
                       WHERE b.id = 'bbbbbbbb-0000-4000-8000-000000000003'),
  'el cliente de plataforma sigue renovando y no se desengancha');
SELECT public.test_ok((SELECT mercadopago_preapproval_id = 'mp-nuevo-5' AND status = 'pending'
                       FROM public.subscriptions WHERE business_id = 'bbbbbbbb-0000-4000-8000-000000000006'),
  'create-subscription (service_role) sigue pudiendo registrar un débito nuevo');

-- ════════════════ 6) Políticas resultantes ════════════════
SELECT public.test_ok(NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions'
                                   AND policyname = 'Business owners can update their subscription'),
  'ya no existe la política de UPDATE del dueño en subscriptions');
SELECT public.test_ok(EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions'
                               AND policyname = 'Super admin can update subscriptions' AND cmd = 'UPDATE'),
  'existe la política de UPDATE solo para superadmin');

\echo 'TODAS LAS PRUEBAS PASARON'

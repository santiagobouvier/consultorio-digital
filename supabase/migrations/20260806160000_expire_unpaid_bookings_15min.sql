-- Retención de reservas impagas: de 45 a 15 minutos (y el cron corre cada 5).
-- 15 min alcanzan de sobra para completar el checkout de Mercado Pago; si la
-- persona abandona el pago, el horario vuelve a estar disponible mucho antes.

DO $$
BEGIN
  PERFORM cron.unschedule('expire-unpaid-public-bookings');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-unpaid-public-bookings',
  '*/5 * * * *',
  $$
  UPDATE public.appointments
  SET status = 'cancelled'
  WHERE status = 'pending_payment'
    AND created_at < now() - interval '15 minutes'
  $$
);

-- Ventana de reservas (Etapa 1): hasta cuándo un turno libre puede
-- reservarse desde la web pública y hasta cuántos días hacia adelante.
-- La anticipación de cancelación ya existe (cancellation_hours_notice).
-- Defaults con los que los consultorios actuales siguen andando solos.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS min_booking_notice_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS max_booking_horizon_days integer NOT NULL DEFAULT 60;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_booking_window_check,
  ADD CONSTRAINT businesses_booking_window_check
    CHECK (
      min_booking_notice_hours BETWEEN 0 AND 720
      AND max_booking_horizon_days BETWEEN 1 AND 365
    );

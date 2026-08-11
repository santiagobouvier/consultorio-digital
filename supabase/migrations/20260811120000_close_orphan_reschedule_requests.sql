-- Las solicitudes de reprogramación quedaban en 'pending' para siempre si la
-- cita original se borraba o cancelaba: la página de Solicitudes las oculta
-- (descarta huérfanas) pero el badge del sidebar las contaba → "2" fantasma.
-- 1) Trigger: al borrar o cancelar una cita, cerrar sus reprogramaciones pendientes.
-- 2) Limpieza: cerrar las huérfanas que ya existen.

CREATE OR REPLACE FUNCTION public.close_orphan_reschedules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.appointment_reschedule_requests
       SET status = 'cancelled', resolved_at = now()
     WHERE original_appointment_id = OLD.id
       AND status = 'pending';
    RETURN OLD;
  END IF;

  IF NEW.status IN ('cancelled', 'cancelled_by_patient')
     AND OLD.status NOT IN ('cancelled', 'cancelled_by_patient') THEN
    UPDATE public.appointment_reschedule_requests
       SET status = 'cancelled', resolved_at = now()
     WHERE original_appointment_id = NEW.id
       AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_close_orphan_reschedules_del ON public.appointments;
CREATE TRIGGER trg_close_orphan_reschedules_del
  AFTER DELETE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.close_orphan_reschedules();

DROP TRIGGER IF EXISTS trg_close_orphan_reschedules_upd ON public.appointments;
CREATE TRIGGER trg_close_orphan_reschedules_upd
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.close_orphan_reschedules();

-- Limpieza de huérfanas existentes (cita borrada o cancelada)
UPDATE public.appointment_reschedule_requests r
   SET status = 'cancelled', resolved_at = now()
 WHERE r.status = 'pending'
   AND (
     NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.id = r.original_appointment_id)
     OR EXISTS (
       SELECT 1 FROM public.appointments a
        WHERE a.id = r.original_appointment_id
          AND a.status IN ('cancelled', 'cancelled_by_patient')
     )
   );

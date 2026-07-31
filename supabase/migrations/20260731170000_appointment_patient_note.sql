-- Nota para el paciente en la cita (julio 2026).
--
-- Problema: appointments.notes se llama "Notas internas" en el panel, pero
-- el portal del paciente la mostraba. Regla nueva, sin ambigüedad:
--   * notes        → privada del profesional (el portal NO la muestra más)
--   * patient_note → explícitamente para el paciente (visible en su portal
--                    como "Indicación de tu profesional")

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_note text;

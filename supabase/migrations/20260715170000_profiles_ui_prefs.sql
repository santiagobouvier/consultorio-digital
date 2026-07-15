-- Preferencias de interfaz por usuario (persisten en la cuenta, no en el
-- navegador). Primer uso: recordar que ya vio la referencia de colores de la
-- agenda, para que el pop-up no reaparezca al cambiar de dispositivo o
-- limpiar datos del navegador.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;

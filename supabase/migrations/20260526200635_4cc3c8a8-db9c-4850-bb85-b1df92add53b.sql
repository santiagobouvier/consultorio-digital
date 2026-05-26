-- Step 2/7: Add owned_by_user_id to spaces + deprecate professional_spaces
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS owned_by_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_spaces_owned_by
  ON public.spaces(business_id, owned_by_user_id);

COMMENT ON COLUMN public.spaces.owned_by_user_id IS
  'NULL = espacio compartido del consultorio (gestionado por el owner). NOT NULL = espacio propio de un profesional independiente (gestionado por ese user).';

COMMENT ON TABLE public.professional_spaces IS
  'DEPRECATED desde Sub-fase A de espacios compartidos. Sustituido por spaces.owned_by_user_id + user_roles.coordination_mode. No usar en código nuevo. Datos existentes se mantienen por compatibilidad.';
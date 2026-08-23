-- Etiquetas fijas con color para eventos personales (Personal, Salud,
-- Familia, Trámite, Ejercicio, Estudio, Descanso). El color vive en el
-- frontend atado a la etiqueta; acá solo se guarda cuál es.

ALTER TABLE public.personal_events
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'personal';

DO $$
BEGIN
  ALTER TABLE public.personal_events
    ADD CONSTRAINT personal_events_category_valid
    CHECK (category IN ('personal','salud','familia','tramite','ejercicio','estudio','descanso'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

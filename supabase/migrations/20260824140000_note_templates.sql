-- Plantillas de nota clínica: cada profesional define su estructura
-- ("Motivo / Trabajo realizado / Tarea / Próxima sesión") y la inserta
-- con un toque al escribir. Privadas de cada profesional.

CREATE TABLE IF NOT EXISTS public.note_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  professional_user_id uuid NOT NULL,
  name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_templates_name_len CHECK (char_length(name) BETWEEN 1 AND 60),
  CONSTRAINT note_templates_content_len CHECK (char_length(content) BETWEEN 1 AND 5000),
  CONSTRAINT note_templates_unique_name UNIQUE (business_id, professional_user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_note_templates_owner
  ON public.note_templates(business_id, professional_user_id);

ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_note_templates_updated_at ON public.note_templates;
CREATE TRIGGER trg_note_templates_updated_at
  BEFORE UPDATE ON public.note_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Privadas: solo el dueño las ve y las maneja
DROP POLICY IF EXISTS "note_templates_own_all" ON public.note_templates;
CREATE POLICY "note_templates_own_all"
  ON public.note_templates FOR ALL
  USING (
    professional_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  )
  WITH CHECK (
    professional_user_id = auth.uid()
    AND public.user_belongs_to_business(auth.uid(), business_id)
  );

DROP POLICY IF EXISTS "note_templates_super_admin_all" ON public.note_templates;
CREATE POLICY "note_templates_super_admin_all"
  ON public.note_templates FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

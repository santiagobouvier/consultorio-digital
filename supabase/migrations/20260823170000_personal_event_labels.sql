-- Etiquetas personalizadas para eventos personales (estilo Google Calendar):
-- cada profesional crea las suyas con nombre y color. Las 7 fijas del
-- frontend siguen existiendo como base; estas se suman.

CREATE TABLE IF NOT EXISTS public.personal_event_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  professional_user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT personal_event_labels_color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT personal_event_labels_name_len CHECK (char_length(name) BETWEEN 1 AND 40),
  CONSTRAINT personal_event_labels_unique_name UNIQUE (business_id, professional_user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_personal_event_labels_owner
  ON public.personal_event_labels(business_id, professional_user_id);

ALTER TABLE public.personal_event_labels ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_personal_event_labels_updated_at ON public.personal_event_labels;
CREATE TRIGGER trg_personal_event_labels_updated_at
  BEFORE UPDATE ON public.personal_event_labels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lectura: todo el consultorio (la agenda compartida muestra los colores
-- de los eventos de otros profesionales). Escritura: solo el dueño.
DROP POLICY IF EXISTS "pe_labels_members_select" ON public.personal_event_labels;
CREATE POLICY "pe_labels_members_select"
  ON public.personal_event_labels FOR SELECT
  USING (public.user_belongs_to_business(auth.uid(), business_id));

DROP POLICY IF EXISTS "pe_labels_own_insert" ON public.personal_event_labels;
CREATE POLICY "pe_labels_own_insert"
  ON public.personal_event_labels FOR INSERT
  WITH CHECK (professional_user_id = auth.uid() AND public.user_belongs_to_business(auth.uid(), business_id));

DROP POLICY IF EXISTS "pe_labels_own_update" ON public.personal_event_labels;
CREATE POLICY "pe_labels_own_update"
  ON public.personal_event_labels FOR UPDATE
  USING (professional_user_id = auth.uid())
  WITH CHECK (professional_user_id = auth.uid());

DROP POLICY IF EXISTS "pe_labels_own_delete" ON public.personal_event_labels;
CREATE POLICY "pe_labels_own_delete"
  ON public.personal_event_labels FOR DELETE
  USING (professional_user_id = auth.uid());

DROP POLICY IF EXISTS "pe_labels_super_admin_all" ON public.personal_event_labels;
CREATE POLICY "pe_labels_super_admin_all"
  ON public.personal_event_labels FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- El evento puede apuntar a una etiqueta custom; si se borra la etiqueta,
-- el evento vuelve a su etiqueta fija (category).
ALTER TABLE public.personal_events
  ADD COLUMN IF NOT EXISTS label_id uuid REFERENCES public.personal_event_labels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personal_events_label
  ON public.personal_events(label_id);

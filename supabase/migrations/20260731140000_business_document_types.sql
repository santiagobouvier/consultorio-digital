-- Tipos de documento propios del consultorio (julio 2026): además de los 6
-- tipos de fábrica (informe, evaluación, consentimiento, indicaciones,
-- recibo, otro), cada profesional puede crear los suyos con un ícono
-- ("Radiografía", "Receta", "Test"...). patient_documents.document_type ya
-- es text: los tipos propios se guardan ahí por su id (uuid).

CREATE TABLE IF NOT EXISTS public.business_document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'folder',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_document_types_business
  ON public.business_document_types (business_id);

ALTER TABLE public.business_document_types ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.business_document_types FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_document_types TO authenticated;
GRANT ALL ON public.business_document_types TO service_role;

CREATE POLICY document_types_select_member
ON public.business_document_types FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY document_types_insert_member
ON public.business_document_types FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY document_types_update_member
ON public.business_document_types FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY document_types_delete_member
ON public.business_document_types FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

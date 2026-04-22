
-- Create patient_documents table
CREATE TABLE public.patient_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  document_type TEXT NOT NULL DEFAULT 'otro' CHECK (document_type IN ('consentimiento', 'informe', 'otro')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_documents_patient ON public.patient_documents(patient_id, created_at DESC);
CREATE INDEX idx_patient_documents_business ON public.patient_documents(business_id);

-- Trigger to update updated_at
CREATE TRIGGER update_patient_documents_updated_at
BEFORE UPDATE ON public.patient_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.patient_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (mismo patrón que session_notes)
CREATE POLICY "patient_documents_select_own_business"
ON public.patient_documents
FOR SELECT
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "patient_documents_insert_own_business"
ON public.patient_documents
FOR INSERT
WITH CHECK (
  public.user_belongs_to_business(auth.uid(), business_id)
  AND uploaded_by = auth.uid()
);

CREATE POLICY "patient_documents_update_own_business"
ON public.patient_documents
FOR UPDATE
USING (public.user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "patient_documents_delete_own_business"
ON public.patient_documents
FOR DELETE
USING (public.user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "patient_documents_super_admin_all"
ON public.patient_documents
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Create private storage bucket for patient documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Path convention: {business_id}/{patient_id}/{filename}
CREATE POLICY "patient_documents_storage_select"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'patient-documents'
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_business(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  )
);

CREATE POLICY "patient_documents_storage_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'patient-documents'
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_business(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  )
);

CREATE POLICY "patient_documents_storage_update"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'patient-documents'
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_business(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  )
);

CREATE POLICY "patient_documents_storage_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'patient-documents'
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_belongs_to_business(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  )
);

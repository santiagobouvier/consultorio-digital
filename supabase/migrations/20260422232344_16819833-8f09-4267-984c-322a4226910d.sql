-- Create session_notes table for private professional notes per patient
CREATE TABLE public.session_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  author_user_id UUID NOT NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_session_notes_patient ON public.session_notes(patient_id, note_date DESC);
CREATE INDEX idx_session_notes_business ON public.session_notes(business_id);
CREATE INDEX idx_session_notes_appointment ON public.session_notes(appointment_id);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

-- Business members can view notes from their business
CREATE POLICY "session_notes_select_own_business"
ON public.session_notes
FOR SELECT
USING (public.user_belongs_to_business(auth.uid(), business_id));

-- Business members can insert notes (must be the author)
CREATE POLICY "session_notes_insert_own_business"
ON public.session_notes
FOR INSERT
WITH CHECK (
  public.user_belongs_to_business(auth.uid(), business_id)
  AND author_user_id = auth.uid()
);

-- Business members can update notes from their business
CREATE POLICY "session_notes_update_own_business"
ON public.session_notes
FOR UPDATE
USING (public.user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (public.user_belongs_to_business(auth.uid(), business_id));

-- Business members can delete notes from their business
CREATE POLICY "session_notes_delete_own_business"
ON public.session_notes
FOR DELETE
USING (public.user_belongs_to_business(auth.uid(), business_id));

-- Super admin full access
CREATE POLICY "session_notes_super_admin_all"
ON public.session_notes
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Auto-update timestamp trigger
CREATE TRIGGER update_session_notes_updated_at
BEFORE UPDATE ON public.session_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============ session_notes ============
DROP POLICY IF EXISTS session_notes_select_own_business ON public.session_notes;
DROP POLICY IF EXISTS session_notes_insert_own_business ON public.session_notes;
DROP POLICY IF EXISTS session_notes_update_own_business ON public.session_notes;
DROP POLICY IF EXISTS session_notes_delete_own_business ON public.session_notes;

CREATE POLICY session_notes_select_prof
ON public.session_notes FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR author_user_id = auth.uid()
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY session_notes_insert_prof
ON public.session_notes FOR INSERT TO authenticated
WITH CHECK (
  user_belongs_to_business(auth.uid(), business_id)
  AND author_user_id = auth.uid()
  AND (is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id))
);

CREATE POLICY session_notes_update_prof
ON public.session_notes FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR author_user_id = auth.uid())
WITH CHECK (is_super_admin(auth.uid()) OR author_user_id = auth.uid());

CREATE POLICY session_notes_delete_prof
ON public.session_notes FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR author_user_id = auth.uid());

-- ============ patient_documents ============
DROP POLICY IF EXISTS patient_documents_select_own_business ON public.patient_documents;
DROP POLICY IF EXISTS patient_documents_insert_own_business ON public.patient_documents;
DROP POLICY IF EXISTS patient_documents_update_own_business ON public.patient_documents;
DROP POLICY IF EXISTS patient_documents_delete_own_business ON public.patient_documents;

CREATE POLICY patient_documents_select_prof
ON public.patient_documents FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY patient_documents_insert_prof
ON public.patient_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (is_super_admin(auth.uid()) OR is_patient_professional(auth.uid(), patient_id))
);

CREATE POLICY patient_documents_update_prof
ON public.patient_documents FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR is_patient_professional(auth.uid(), patient_id)
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY patient_documents_delete_prof
ON public.patient_documents FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR uploaded_by = auth.uid()
  OR is_patient_professional(auth.uid(), patient_id)
);

-- ============ scheduled_reminders ============
DROP POLICY IF EXISTS reminders_select_own_business ON public.scheduled_reminders;
DROP POLICY IF EXISTS reminders_insert_own_business ON public.scheduled_reminders;
DROP POLICY IF EXISTS reminders_update_own_business ON public.scheduled_reminders;
DROP POLICY IF EXISTS reminders_delete_own_business ON public.scheduled_reminders;

CREATE POLICY reminders_select_prof
ON public.scheduled_reminders FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY reminders_insert_prof
ON public.scheduled_reminders FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY reminders_update_prof
ON public.scheduled_reminders FOR UPDATE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY reminders_delete_prof
ON public.scheduled_reminders FOR DELETE TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

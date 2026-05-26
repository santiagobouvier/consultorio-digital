
DROP POLICY IF EXISTS notif_business_insert ON public.patient_notifications;

CREATE POLICY notif_prof_insert
ON public.patient_notifications FOR INSERT TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

CREATE POLICY notif_prof_select
ON public.patient_notifications FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_patient_professional(auth.uid(), patient_id)
);

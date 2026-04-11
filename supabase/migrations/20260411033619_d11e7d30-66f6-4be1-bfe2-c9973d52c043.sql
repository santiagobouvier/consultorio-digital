
-- 1. Super admin DELETE policies for all tables needed in cascade delete

-- businesses: allow super_admin to delete
CREATE POLICY "Super admin can delete businesses"
ON public.businesses
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- user_roles: allow super_admin to delete
CREATE POLICY "Super admin can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- scheduled_reminders: allow super_admin to delete
CREATE POLICY "Super admin can delete reminders"
ON public.scheduled_reminders
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- payments: allow super_admin to delete
CREATE POLICY "Super admin can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- appointments: allow super_admin to delete
CREATE POLICY "Super admin can delete appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- availability_slots: allow super_admin to delete
CREATE POLICY "Super admin can delete availability slots"
ON public.availability_slots
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- patients: allow super_admin to delete
CREATE POLICY "Super admin can delete patients"
ON public.patients
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- services: allow super_admin to delete/manage
CREATE POLICY "Super admin can manage services"
ON public.services
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- patient_portal_invites: allow super_admin to delete
CREATE POLICY "Super admin can delete patient invites"
ON public.patient_portal_invites
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- professional_portal_invites: allow super_admin to delete
CREATE POLICY "Super admin can delete professional invites"
ON public.professional_portal_invites
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- 2. Validation trigger to enforce max patients limit
CREATE OR REPLACE FUNCTION public.enforce_patient_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_add boolean;
BEGIN
  SELECT public.can_add_patient(NEW.business_id) INTO v_can_add;
  IF NOT v_can_add THEN
    RAISE EXCEPTION 'Se alcanzó el límite máximo de pacientes para este consultorio';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_patient_limit
BEFORE INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.enforce_patient_limit();

-- 3. Validation trigger to enforce max professionals limit
CREATE OR REPLACE FUNCTION public.enforce_professional_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_add boolean;
BEGIN
  -- Only check for owner/professional roles with a business_id
  IF NEW.role IN ('owner', 'professional') AND NEW.business_id IS NOT NULL THEN
    SELECT public.can_add_professional(NEW.business_id) INTO v_can_add;
    IF NOT v_can_add THEN
      RAISE EXCEPTION 'Se alcanzó el límite máximo de profesionales para este consultorio';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_professional_limit
BEFORE INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_professional_limit();

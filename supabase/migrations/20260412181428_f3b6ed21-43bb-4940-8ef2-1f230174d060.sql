
-- Step 1: Add new columns to scheduled_reminders
ALTER TABLE public.scheduled_reminders 
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'reminder',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS auto_send boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_id uuid;

-- Step 2: Backfill business_id from appointments for existing rows
UPDATE public.scheduled_reminders sr
SET business_id = a.business_id,
    status = CASE WHEN sr.sent THEN 'sent' ELSE 'scheduled' END
FROM public.appointments a
WHERE sr.appointment_id = a.id;

-- Step 3: Make business_id NOT NULL after backfill
ALTER TABLE public.scheduled_reminders 
  ALTER COLUMN business_id SET NOT NULL;

-- Step 4: Drop old 'sent' column
ALTER TABLE public.scheduled_reminders DROP COLUMN IF EXISTS sent;

-- Step 5: Add clinic_settings columns for reminder config
ALTER TABLE public.clinic_settings
  ADD COLUMN IF NOT EXISTS reminder_hours_before integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS auto_email_reminders boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_whatsapp_reminders boolean NOT NULL DEFAULT true;

-- Step 6: Add indexes
CREATE INDEX IF NOT EXISTS idx_reminders_business_status ON public.scheduled_reminders(business_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled_for ON public.scheduled_reminders(scheduled_for, status);

-- Step 7: Drop ALL existing RLS policies on scheduled_reminders
DROP POLICY IF EXISTS "Super admin can delete reminders" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "Super admin can view all reminders" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "scheduled_reminders_delete_own_business" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "scheduled_reminders_insert_own_business" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "scheduled_reminders_select_own_business" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "scheduled_reminders_update_own_business" ON public.scheduled_reminders;

-- Step 8: Create new RLS policies using business_id directly
CREATE POLICY "reminders_select_own_business"
ON public.scheduled_reminders FOR SELECT
TO authenticated
USING (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "reminders_insert_own_business"
ON public.scheduled_reminders FOR INSERT
TO authenticated
WITH CHECK (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "reminders_update_own_business"
ON public.scheduled_reminders FOR UPDATE
TO authenticated
USING (user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "reminders_delete_own_business"
ON public.scheduled_reminders FOR DELETE
TO authenticated
USING (user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY "reminders_super_admin_all"
ON public.scheduled_reminders FOR ALL
TO authenticated
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Step 9: Create trigger function to auto-create reminders when appointment is confirmed
CREATE OR REPLACE FUNCTION public.auto_create_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_hours_before integer := 24;
  v_auto_email boolean := true;
  v_auto_whatsapp boolean := true;
  v_patient_name text;
  v_patient_phone text;
  v_reminder_template text;
  v_message text;
  v_reminder_date timestamptz;
  v_owner_id uuid;
BEGIN
  -- Only trigger on new appointments or status change to confirmed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed' AND NEW.status = 'confirmed') THEN
    
    -- Get business owner for clinic_settings lookup
    SELECT owner_user_id INTO v_owner_id FROM public.businesses WHERE id = NEW.business_id;
    
    -- Load clinic settings
    SELECT 
      COALESCE(cs.reminder_hours_before, 24),
      COALESCE(cs.auto_email_reminders, true),
      COALESCE(cs.auto_whatsapp_reminders, true),
      cs.default_reminder_message
    INTO v_hours_before, v_auto_email, v_auto_whatsapp, v_reminder_template
    FROM public.clinic_settings cs
    WHERE cs.user_id = v_owner_id;
    
    -- Get patient info
    IF NEW.patient_id IS NOT NULL THEN
      SELECT full_name, whatsapp_phone INTO v_patient_name, v_patient_phone
      FROM public.patients WHERE id = NEW.patient_id;
    ELSE
      v_patient_name := COALESCE(NEW.contact_name, 'Paciente');
      v_patient_phone := NEW.contact_phone;
    END IF;
    
    -- Build message
    v_reminder_template := COALESCE(v_reminder_template, 
      'Hola {{paciente}}, te recuerdo tu sesión del {{fecha}} a las {{hora}}. Modalidad: {{modalidad}}.');
    
    v_message := replace(v_reminder_template, '{{paciente}}', COALESCE(v_patient_name, 'Paciente'));
    v_message := replace(v_message, '{{fecha}}', to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'DD/MM/YYYY'));
    v_message := replace(v_message, '{{hora}}', to_char(NEW.start_at AT TIME ZONE 'America/Montevideo', 'HH24:MI'));
    v_message := replace(v_message, '{{modalidad}}', CASE WHEN NEW.modality = 'online' THEN 'Online' ELSE 'Presencial' END);
    v_message := replace(v_message, '{{link}}', COALESCE(NEW.location, ''));
    
    -- Calculate reminder date
    v_reminder_date := NEW.start_at - (v_hours_before || ' hours')::interval;
    
    -- Don't create reminders for past dates
    IF v_reminder_date > now() THEN
      -- Create email reminder (auto-send)
      IF v_auto_email THEN
        INSERT INTO public.scheduled_reminders 
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES 
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'email', 'reminder', 'scheduled', true);
      END IF;
      
      -- Create WhatsApp reminder (manual send)
      IF v_auto_whatsapp AND v_patient_phone IS NOT NULL THEN
        INSERT INTO public.scheduled_reminders 
          (appointment_id, patient_id, business_id, scheduled_for, message, channel, type, status, auto_send)
        VALUES 
          (NEW.id, NEW.patient_id, NEW.business_id, v_reminder_date, v_message, 'whatsapp', 'reminder', 'pending_manual', false);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 10: Create trigger on appointments
DROP TRIGGER IF EXISTS trigger_auto_create_reminders ON public.appointments;
CREATE TRIGGER trigger_auto_create_reminders
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_reminders();

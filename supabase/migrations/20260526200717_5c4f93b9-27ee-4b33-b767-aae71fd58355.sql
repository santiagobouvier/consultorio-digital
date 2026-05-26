-- Step 4/7: Trigger to auto-generate "Mi consultorio" + "Online" for independent professionals
CREATE OR REPLACE FUNCTION public.handle_coordination_mode_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act when going TO independent, with a business and a relevant role
  IF NEW.coordination_mode <> 'independent'
     OR NEW.business_id IS NULL
     OR NEW.role NOT IN ('owner','professional') THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, skip if mode didn't actually change to independent
  IF TG_OP = 'UPDATE'
     AND OLD.coordination_mode = 'independent'
     AND OLD.business_id IS NOT DISTINCT FROM NEW.business_id THEN
    RETURN NEW;
  END IF;

  -- "Mi consultorio" (physical)
  INSERT INTO public.spaces (business_id, name, type, capacity, owned_by_user_id, is_active)
  SELECT NEW.business_id, 'Mi consultorio', 'physical', 1, NEW.user_id, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.business_id = NEW.business_id
      AND s.owned_by_user_id = NEW.user_id
      AND s.name = 'Mi consultorio'
  );

  -- Reactivate if it already existed but was soft-disabled
  UPDATE public.spaces
     SET is_active = true, updated_at = now()
   WHERE business_id = NEW.business_id
     AND owned_by_user_id = NEW.user_id
     AND name = 'Mi consultorio'
     AND is_active = false;

  -- "Online" (virtual)
  INSERT INTO public.spaces (business_id, name, type, capacity, owned_by_user_id, is_active)
  SELECT NEW.business_id, 'Online', 'virtual', 1, NEW.user_id, true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.spaces s
    WHERE s.business_id = NEW.business_id
      AND s.owned_by_user_id = NEW.user_id
      AND s.name = 'Online'
  );

  UPDATE public.spaces
     SET is_active = true, updated_at = now()
   WHERE business_id = NEW.business_id
     AND owned_by_user_id = NEW.user_id
     AND name = 'Online'
     AND is_active = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_coordination_mode_change ON public.user_roles;
CREATE TRIGGER trg_handle_coordination_mode_change
AFTER INSERT OR UPDATE OF coordination_mode ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.handle_coordination_mode_change();
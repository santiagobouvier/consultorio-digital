-- Cuentas bancarias del consultorio (julio 2026): para mandar al paciente
-- los datos de transferencia por WhatsApp con un click. Se gestionan en
-- Configuración → Pagos; puede haber varias (BROU pesos, Itaú dólares...).
--
-- El paciente nunca accede a esta tabla: los datos viajan solamente dentro
-- del mensaje de WhatsApp que el profesional decide mandar desde su teléfono
-- (link wa.me — no pasa por la API de Meta, no gasta cupo).

CREATE TABLE IF NOT EXISTS public.business_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_name text NOT NULL,
  account_holder text NOT NULL,
  account_number text NOT NULL,
  currency text NOT NULL DEFAULT 'UYU' CHECK (currency IN ('UYU', 'USD')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_bank_accounts_business
  ON public.business_bank_accounts (business_id);

DROP TRIGGER IF EXISTS set_business_bank_accounts_updated_at ON public.business_bank_accounts;
CREATE TRIGGER set_business_bank_accounts_updated_at
  BEFORE UPDATE ON public.business_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.business_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Grants explícitos (mismo criterio que patient_clinical_status)
REVOKE ALL ON public.business_bank_accounts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_bank_accounts TO authenticated;
GRANT ALL ON public.business_bank_accounts TO service_role;

-- Solo miembros del consultorio (mismo modelo que payment_policies)
CREATE POLICY bank_accounts_select_member
ON public.business_bank_accounts FOR SELECT TO authenticated
USING (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY bank_accounts_insert_member
ON public.business_bank_accounts FOR INSERT TO authenticated
WITH CHECK (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY bank_accounts_update_member
ON public.business_bank_accounts FOR UPDATE TO authenticated
USING (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id))
WITH CHECK (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

CREATE POLICY bank_accounts_delete_member
ON public.business_bank_accounts FOR DELETE TO authenticated
USING (is_super_admin(auth.uid()) OR user_belongs_to_business(auth.uid(), business_id));

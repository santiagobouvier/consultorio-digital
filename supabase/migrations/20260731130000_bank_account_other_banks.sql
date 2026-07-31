-- Cuentas bancarias: número alternativo para transferencias desde OTROS
-- bancos (en Uruguay suele ser un código distinto al de la cuenta interna).
-- Opcional: si está, el mensaje de WhatsApp muestra los dos.

ALTER TABLE public.business_bank_accounts
  ADD COLUMN IF NOT EXISTS account_number_other_banks text;

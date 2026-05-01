CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_business_id_unique_idx
ON public.subscriptions (business_id);

CREATE INDEX IF NOT EXISTS subscriptions_mercadopago_preapproval_id_idx
ON public.subscriptions (mercadopago_preapproval_id);

CREATE INDEX IF NOT EXISTS subscriptions_business_status_idx
ON public.subscriptions (business_id, status);
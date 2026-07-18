import { supabase } from "@/integrations/supabase/client";

/**
 * Genera (o actualiza) el link de cobro de Mercado Pago para uno o varios
 * pagos del mismo paciente. Devuelve la URL lista para compartir.
 * El backend garantiza un solo link vivo por pago (actualiza la preferencia
 * existente o expira las reemplazadas).
 */
export async function createPaymentLink(businessId: string, paymentIds: string[]): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-payment-link", {
    body: { business_id: businessId, payment_ids: paymentIds },
  });
  if (error) throw new Error(error.message || "No se pudo generar el link");
  if (data?.error) throw new Error(data.error);
  if (!data?.url) throw new Error("Mercado Pago no devolvió el link");
  return data.url as string;
}

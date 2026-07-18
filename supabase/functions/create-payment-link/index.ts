// Genera (o actualiza) un link de cobro de Mercado Pago para uno o varios
// pagos pendientes, PEDIDO POR EL PROFESIONAL (dueño o miembro del negocio).
// El link queda atado a los pagos vía external_reference type "payment_batch",
// que el webhook ya sabe procesar: cuando el paciente paga, los pagos se
// marcan cobrados solos.
//
// Regla anti-doble-cobro: un mismo pago nunca tiene dos links vivos.
//  - Si todos los pagos comparten una preferencia previa, se ACTUALIZA esa
//    preferencia (mismo link, monto vigente).
//  - Si había preferencias viejas distintas (ej: un link individual y ahora
//    se genera uno por el total), las viejas se EXPIRAN (best effort).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const LINK_TTL_DAYS = 30;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const businessId: string = body.business_id;
    const paymentIds: string[] = Array.isArray(body.payment_ids) ? body.payment_ids : [];

    if (!businessId || typeof businessId !== "string") return json({ error: "Missing business_id" }, 400);
    if (paymentIds.length === 0 || !paymentIds.every((id) => typeof id === "string")) {
      return json({ error: "Missing payment_ids" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // El usuario debe ser dueño o profesional del negocio
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, public_slug, owner_user_id")
      .eq("id", businessId)
      .maybeSingle();
    if (!business) return json({ error: "Business not found" }, 404);

    let authorized = business.owner_user_id === userId;
    if (!authorized) {
      const { data: role } = await supabase
        .from("user_roles")
        .select("id")
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .in("role", ["owner", "professional"])
        .maybeSingle();
      authorized = !!role;
    }
    if (!authorized) return json({ error: "Not authorized for this business" }, 403);

    // Pagos: todos del negocio, del mismo paciente, y cobrables
    const { data: payments, error: payErr } = await supabase
      .from("payments")
      .select("id, amount, currency, status, notes, patient_id, mp_preference_id")
      .in("id", paymentIds)
      .eq("business_id", businessId);

    if (payErr || !payments || payments.length !== paymentIds.length) {
      return json({ error: "Algunos pagos no existen o no pertenecen a tu consultorio" }, 403);
    }
    if (payments.some((p) => p.status === "paid" || p.status === "cancelled")) {
      return json({ error: "Alguno de los pagos ya está cobrado o cancelado" }, 400);
    }
    const patientId = payments[0].patient_id;
    if (!payments.every((p) => p.patient_id === patientId)) {
      return json({ error: "Todos los pagos del link deben ser del mismo paciente" }, 400);
    }

    const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    if (totalAmount <= 0) return json({ error: "El monto total debe ser mayor a cero" }, 400);

    // Token de MP del consultorio
    const { data: policy } = await supabase
      .from("payment_policies")
      .select("mp_access_token")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!policy?.mp_access_token) {
      return json({ error: "Conectá tu cuenta de Mercado Pago para generar links de cobro" }, 400);
    }
    const mpToken = policy.mp_access_token as string;

    const { data: patient } = await supabase
      .from("patients")
      .select("full_name")
      .eq("id", patientId)
      .maybeSingle();
    const patientFirstName = (patient?.full_name || "Paciente").split(" ")[0];
    const clinicName = business.name || "Consultorio";

    const title = payments.length === 1
      ? `Sesión de ${patientFirstName} — ${clinicName}`
      : `Pago de ${payments.length} sesiones de ${patientFirstName} — ${clinicName}`;

    const externalReference = JSON.stringify({
      type: "payment_batch",
      payment_ids: paymentIds,
      business_id: businessId,
      patient_id: patientId,
    });

    const slug = business.public_slug || "";
    const backBase = `https://consultoriodigital.app/portal/${slug}`;
    const now = Date.now();
    const preferencePayload = {
      items: [{
        title,
        quantity: 1,
        unit_price: totalAmount,
        currency_id: payments[0].currency || "UYU",
      }],
      back_urls: {
        success: `${backBase}?payment=success&batch=1`,
        failure: `${backBase}?payment=failure`,
        pending: `${backBase}?payment=pending`,
      },
      auto_return: "approved",
      external_reference: externalReference,
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      expires: true,
      expiration_date_from: new Date(now).toISOString(),
      expiration_date_to: new Date(now + LINK_TTL_DAYS * 86400000).toISOString(),
    };

    const mpHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${mpToken}`,
    };

    // ¿Todos los pagos ya comparten una preferencia? → actualizarla (mismo link)
    const sharedPrefId =
      payments[0].mp_preference_id &&
      payments.every((p) => p.mp_preference_id === payments[0].mp_preference_id)
        ? (payments[0].mp_preference_id as string)
        : null;

    // Preferencias viejas distintas que este link reemplaza → expirarlas
    const stalePrefIds = Array.from(
      new Set(
        payments
          .map((p) => p.mp_preference_id)
          .filter((id): id is string => !!id && id !== sharedPrefId),
      ),
    );

    let pref: any = null;

    if (sharedPrefId) {
      const updResp = await fetch(`https://api.mercadopago.com/checkout/preferences/${sharedPrefId}`, {
        method: "PUT",
        headers: mpHeaders,
        body: JSON.stringify(preferencePayload),
      });
      if (updResp.ok) {
        pref = await updResp.json();
      } else {
        console.warn("MP preference update failed, creating a new one:", updResp.status, await updResp.text());
      }
    }

    if (!pref) {
      const createResp = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: mpHeaders,
        body: JSON.stringify(preferencePayload),
      });
      if (!createResp.ok) {
        console.error("MP preference creation failed:", createResp.status, await createResp.text());
        return json({ error: "Mercado Pago rechazó la creación del link. Probá de nuevo." }, 502);
      }
      pref = await createResp.json();
    }

    // Expirar preferencias reemplazadas (best effort, no bloquea)
    for (const staleId of stalePrefIds) {
      try {
        await fetch(`https://api.mercadopago.com/checkout/preferences/${staleId}`, {
          method: "PUT",
          headers: mpHeaders,
          body: JSON.stringify({
            expires: true,
            expiration_date_to: new Date(now - 60000).toISOString(),
          }),
        });
      } catch (e) {
        console.warn("Could not expire stale preference", staleId, e);
      }
    }

    const linkUrl = pref.init_point as string;

    await supabase
      .from("payments")
      .update({
        mp_preference_id: pref.id,
        mp_link_url: linkUrl,
        mp_link_status: "created",
        mp_link_created_at: new Date().toISOString(),
      })
      .in("id", paymentIds);

    return json({
      url: linkUrl,
      preference_id: pref.id,
      amount: totalAmount,
      payment_count: payments.length,
    });
  } catch (error) {
    console.error("create-payment-link error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});

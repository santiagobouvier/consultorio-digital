import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mercadoPagoToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    const { type, data } = body;

    const parseExternalReference = (value: unknown) => {
      if (typeof value !== "string" || !value.trim()) return null;
      try {
        return JSON.parse(value) as {
          business_id?: string;
          plan_code?: string;
          billing_period?: string;
          amount?: number;
        };
      } catch {
        return null;
      }
    };

    // Mercado Pago sends different notification types
    // For subscriptions (preapproval): type = "subscription_preapproval"
    // For payments: type = "payment"
    
    if (type === "subscription_preapproval" && data?.id) {
      // Fetch preapproval details from MP
      const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${data.id}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      });

      if (!mpResponse.ok) {
        console.error("Failed to fetch preapproval:", mpResponse.status);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const preapproval = await mpResponse.json();
      console.log("Preapproval status:", preapproval.status);

      // Map MP status to our status
      let newStatus: string;
      switch (preapproval.status) {
        case "authorized":
          newStatus = "active";
          break;
        case "paused":
        case "pending":
          newStatus = "pending";
          break;
        case "cancelled":
          newStatus = "cancelled";
          break;
        default:
          newStatus = "pending";
      }

      // Find subscription by MP preapproval id
      const { data: subscription, error: findError } = await supabase
        .from("subscriptions")
        .select("id, business_id, status, plan_code, billing_period, trial_ends_at")
        .eq("mercadopago_preapproval_id", data.id)
        .maybeSingle();

      if (findError || !subscription) {
        console.error("Subscription not found for preapproval:", data.id);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      // GUARDA DE ACCESO: un preapproval "pending" (checkout abandonado) o
      // "cancelled" (canceló el débito) NO debe pisar una prueba vigente ni
      // bloquear a un activo por un intento de cambio de plan a medias.
      const trialStillValid = subscription.status === "trial"
        && !!subscription.trial_ends_at
        && new Date(subscription.trial_ends_at).getTime() > Date.now();

      if ((newStatus === "pending" || newStatus === "cancelled") && trialStillValid) {
        console.log(`Preapproval ${newStatus} pero el trial sigue vigente: se mantiene el acceso`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }
      if (newStatus === "pending" && subscription.status === "active") {
        console.log("Preapproval pending pero la suscripción está activa: se mantiene el acceso");
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const externalReference = parseExternalReference(preapproval.external_reference);

      // Update subscription status
      const updateData: Record<string, unknown> = {
        status: newStatus,
        cancelled_at: newStatus === "cancelled" ? new Date().toISOString() : null,
      };

      if (externalReference?.plan_code) updateData.plan_code = externalReference.plan_code;
      if (externalReference?.billing_period) updateData.billing_period = externalReference.billing_period;
      if (typeof externalReference?.amount === "number") updateData.amount = externalReference.amount;

      if (newStatus === "active" && preapproval.next_payment_date) {
        updateData.current_period_end = preapproval.next_payment_date;
        updateData.current_period_start = new Date().toISOString();
      }

      await supabase
        .from("subscriptions")
        .update(updateData)
        .eq("id", subscription.id);

      // Update business active status
      if (newStatus === "cancelled" || newStatus === "expired" || newStatus === "pending") {
        await supabase
          .from("businesses")
          .update({ is_active: false })
          .eq("id", subscription.business_id);
      } else if (newStatus === "active") {
        await supabase
          .from("businesses")
          .update({
            is_active: true,
            plan_code: externalReference?.plan_code || subscription.plan_code,
            billing_period: externalReference?.billing_period || subscription.billing_period,
            plan_started_at: new Date().toISOString(),
          })
          .eq("id", subscription.business_id);
      }

      console.log(`Subscription ${subscription.id} updated to ${newStatus}`);
    }

    if (type === "payment" && data?.id) {
      // Try fetching with platform token first
      let mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
        headers: { Authorization: `Bearer ${mercadoPagoToken}` },
      });

      // If platform token fails (403/401), this may be a session payment made with a clinic token.
      // We'll try to find the right token below after parsing external_reference.
      let payment: any = null;
      let usedClinicToken = false;

      if (!mpResponse.ok) {
        console.log("Platform token failed for payment, will try clinic token after parsing reference");
      } else {
        payment = await mpResponse.json();
      }

      // If we couldn't fetch with platform token, try to get payment info
      // from the notification body or try clinic tokens
      if (!payment) {
        // Try to fetch using all clinic tokens (fallback)
        const { data: policies } = await supabase
          .from("payment_policies")
          .select("mp_access_token, business_id")
          .not("mp_access_token", "is", null);

        if (policies) {
          for (const p of policies) {
            const tryResp = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
              headers: { Authorization: `Bearer ${p.mp_access_token}` },
            });
            if (tryResp.ok) {
              payment = await tryResp.json();
              usedClinicToken = true;
              break;
            }
          }
        }

        if (!payment) {
          console.error("Failed to fetch payment with any token:", data.id);
          return new Response("OK", { status: 200, headers: corsHeaders });
        }
      }

      console.log("Payment status:", payment.status, "external_reference:", payment.external_reference);

      // Parse external_reference to determine payment type
      const extRef = parseExternalReference(payment.external_reference);

      // SESSION PAYMENT: external_reference has type "session_payment"
      if (extRef && (extRef as any).type === "session_payment" && payment.status === "approved") {
        const sessionRef = extRef as {
          type: string;
          appointment_id?: string;
          business_id?: string;
          patient_id?: string;
        };

        console.log("Session payment approved:", sessionRef);

        if (sessionRef.appointment_id) {
          // Estado previo: si la cita esperaba el pago para confirmarse
          // (reserva pública con política "required"), acá van los avisos
          // que la reserva no mandó.
          const { data: appt } = await supabase
            .from("appointments")
            .select("id, status, business_id, start_at, modality, contact_name, contact_email, contact_phone")
            .eq("id", sessionRef.appointment_id)
            .maybeSingle();
          const wasAwaitingPayment = appt?.status === "pending_payment";

          // Update payment record to paid
          await supabase
            .from("payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              method: "mercadopago",
            })
            .eq("appointment_id", sessionRef.appointment_id)
            .eq("status", "pending");

          // Update appointment status to confirmed and payment_status to pagado
          await supabase
            .from("appointments")
            .update({
              status: "confirmed",
              payment_status: "pagado",
            })
            .eq("id", sessionRef.appointment_id);

          console.log(`Session payment confirmed for appointment ${sessionRef.appointment_id}`);

          if (wasAwaitingPayment && appt) {
            const { data: biz } = await supabase
              .from("businesses")
              .select("id, name, contact_email, owner_user_id")
              .eq("id", appt.business_id)
              .maybeSingle();

            const startAt = new Date(appt.start_at);
            const dateStr = startAt.toLocaleDateString("es-UY", {
              day: "2-digit", month: "2-digit", year: "numeric",
              timeZone: "America/Montevideo",
            });
            const timeStr = startAt.toLocaleTimeString("es-UY", {
              hour: "2-digit", minute: "2-digit",
              timeZone: "America/Montevideo",
            });
            const modLabel = appt.modality === "online" ? "Online" : "Presencial";

            // Mail de confirmación al paciente
            try {
              if (appt.contact_email) {
                await fetch(`${supabaseUrl}/functions/v1/send-resend-email`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    to: appt.contact_email,
                    template: "appointment_confirmation",
                    businessId: appt.business_id,
                    data: {
                      patientName: appt.contact_name || "",
                      date: dateStr,
                      time: timeStr,
                      modality: appt.modality,
                      location: null,
                    },
                  }),
                });
              }
            } catch (mailErr) {
              console.warn("Paid-booking patient email failed:", mailErr);
            }

            // Mail "Nueva reserva pagada" al profesional
            try {
              if (biz?.contact_email) {
                await fetch(`${supabaseUrl}/functions/v1/send-resend-email`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    to: biz.contact_email,
                    template: "raw",
                    businessId: appt.business_id,
                    data: {
                      subject: `Nueva reserva pagada: ${appt.contact_name || "Paciente"} · ${dateStr} ${timeStr}`,
                      message:
                        `Tenés una nueva reserva online con el pago ya realizado.\n\n` +
                        `Paciente: ${appt.contact_name || "-"}\n` +
                        `Fecha: ${dateStr} a las ${timeStr} · ${modLabel}\n` +
                        `Teléfono: ${appt.contact_phone || "-"}\nEmail: ${appt.contact_email || "-"}` +
                        `\n\nLa cita quedó confirmada en tu agenda y el cobro figura como pagado.`,
                    },
                  }),
                });
              }
            } catch (ownerMailErr) {
              console.warn("Paid-booking owner email failed:", ownerMailErr);
            }

            // Push al dueño
            try {
              if (biz?.owner_user_id) {
                await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    user_id: biz.owner_user_id,
                    title: "Nueva reserva pagada",
                    body: `${appt.contact_name || "Un paciente"} reservó y pagó la sesión del ${dateStr} ${timeStr}.`,
                    url: "/agenda",
                  }),
                });
              }
            } catch (pushErr) {
              console.warn("Paid-booking push failed:", pushErr);
            }
          }
        }
      }
      // PATIENT PAYMENT BATCH: external_reference has type "payment_batch"
      else if (extRef && (extRef as any).type === "payment_batch" && payment.status === "approved") {
        const batchRef = extRef as {
          type: string;
          payment_ids?: string[];
          business_id?: string;
          patient_id?: string;
        };

        console.log("Payment batch approved:", batchRef);

        if (Array.isArray(batchRef.payment_ids) && batchRef.payment_ids.length > 0) {
          // Mark all payments in batch as paid
          const { data: updatedPayments, error: updErr } = await supabase
            .from("payments")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              method: "mercadopago",
            })
            .in("id", batchRef.payment_ids)
            .neq("status", "paid")
            .select("id, appointment_id");

          if (updErr) {
            console.error("Failed to mark batch payments as paid:", updErr);
          } else {
            console.log(`Batch marked paid: ${updatedPayments?.length || 0} payments`);

            // For any payment linked to an appointment, also confirm appointment payment_status
            const apptIds = (updatedPayments || [])
              .map((p) => p.appointment_id)
              .filter((id): id is string => !!id);
            if (apptIds.length > 0) {
              await supabase
                .from("appointments")
                .update({ payment_status: "pagado" })
                .in("id", apptIds);
            }
          }
        }
      }
      // SUBSCRIPTION PAYMENT: has preapproval_id in metadata
      else if (payment.status === "approved" && payment.metadata?.preapproval_id) {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("id, business_id, plan_code, billing_period")
          .eq("mercadopago_preapproval_id", payment.metadata.preapproval_id)
          .maybeSingle();

        if (subscription) {
          const externalReference = parseExternalReference(payment.external_reference);

          // Renovación: extender el período hasta el próximo cobro de MP
          // (sin esto, current_period_end quedaba congelado en el primer mes).
          let periodEnd: string | null = null;
          try {
            const preResp = await fetch(
              `https://api.mercadopago.com/preapproval/${payment.metadata.preapproval_id}`,
              { headers: { Authorization: `Bearer ${mercadoPagoToken}` } }
            );
            if (preResp.ok) {
              const pre = await preResp.json();
              periodEnd = pre.next_payment_date ?? null;
            }
          } catch (e) {
            console.error("No se pudo leer next_payment_date del preapproval:", e);
          }

          await supabase
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: new Date().toISOString(),
              ...(periodEnd ? { current_period_end: periodEnd } : {}),
              cancelled_at: null,
              ...(externalReference?.plan_code ? { plan_code: externalReference.plan_code } : {}),
              ...(externalReference?.billing_period ? { billing_period: externalReference.billing_period } : {}),
              ...(typeof externalReference?.amount === "number" ? { amount: externalReference.amount } : {}),
            })
            .eq("id", subscription.id);

          await supabase
            .from("businesses")
            .update({
              is_active: true,
              plan_code: externalReference?.plan_code || subscription.plan_code,
              billing_period: externalReference?.billing_period || subscription.billing_period,
              plan_started_at: new Date().toISOString(),
            })
            .eq("id", subscription.business_id);
        }
      }
    }

    // Always return 200 to acknowledge receipt
    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Webhook error:", error);
    // Still return 200 to prevent MP from retrying
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});

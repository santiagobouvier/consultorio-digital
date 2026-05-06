import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { slug, slotId, name, email, phone, message } = body ?? {};

    if (!slug || !slotId || !name || !email || !phone) {
      return new Response(
        JSON.stringify({ error: "missing_fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find business by public slug
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_user_id")
      .eq("public_slug", slug)
      .maybeSingle();

    if (businessError) {
      console.error("Error loading business:", businessError);
      return new Response(
        JSON.stringify({ error: "business_lookup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!business) {
      return new Response(
        JSON.stringify({ error: "business_not_found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get slot and verify it's available
    const { data: slot, error: slotError } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("id", slotId)
      .eq("business_id", business.id)
      .eq("status", "available")
      .maybeSingle();

    if (slotError) {
      console.error("Error loading slot:", slotError);
      return new Response(
        JSON.stringify({ error: "slot_lookup_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!slot) {
      return new Response(
        JSON.stringify({ error: "slot_not_available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create or find patient
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("business_id", business.id)
      .eq("whatsapp_phone", phone)
      .maybeSingle();

    let patientId = existingPatient?.id;

    if (!patientId) {
      const { data: newPatient, error: patientError } = await supabase
        .from("patients")
        .insert({
          business_id: business.id,
          full_name: name,
          email,
          whatsapp_phone: phone,
          reason_for_consultation: message || null,
        })
        .select("id")
        .maybeSingle();

      if (patientError || !newPatient) {
        console.error("Error creating patient:", patientError);
        return new Response(
          JSON.stringify({ error: "patient_creation_failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      patientId = newPatient.id;
    }

    // Create appointment with slot datetime
    const startDatetime = new Date(`${slot.date}T${slot.start_time}`);
    const endDatetime = new Date(`${slot.date}T${slot.end_time}`);

    const { error: appointmentError } = await supabase
      .from("appointments")
      .insert({
        business_id: business.id,
        patient_id: patientId,
        availability_slot_id: slotId,
        start_at: startDatetime.toISOString(),
        end_at: endDatetime.toISOString(),
        modality: slot.modality,
        contact_name: name,
        contact_email: email,
        contact_phone: phone,
        notes: message || null,
        status: "confirmed",
        source: "public_booking",
      });

    if (appointmentError) {
      console.error("Error creating appointment:", appointmentError);
      return new Response(
        JSON.stringify({ error: "appointment_creation_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark slot as reserved
    const { error: updateError } = await supabase
      .from("availability_slots")
      .update({ status: "reserved" })
      .eq("id", slotId);

    if (updateError) {
      console.error("Error updating slot:", updateError);
      // Don't fail the request if slot update fails, appointment is already created
    }

    // Best-effort push notification to business owner
    try {
      const pushUrl = `${supabaseUrl}/functions/v1/send-push-notification`;
      await fetch(pushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          user_id: business.owner_user_id,
          title: "Nueva solicitud de turno",
          body: `${name} solicitó un turno para el ${slot.date}.`,
          url: "/solicitudes",
        }),
      });
    } catch (pushErr) {
      console.warn("Push notification to owner failed:", pushErr);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Unexpected error in public-create-appointment-request:", error);
    return new Response(
      JSON.stringify({ error: "unexpected_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

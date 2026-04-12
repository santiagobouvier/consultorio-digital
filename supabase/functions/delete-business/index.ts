import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify super_admin
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: isSuperAdmin } = await serviceClient.rpc("is_super_admin", { _user_id: user.id });
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Solo super_admin puede eliminar consultorios" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { businessId } = await req.json();
    if (!businessId) {
      return new Response(JSON.stringify({ error: "businessId es requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify business exists
    const { data: business, error: bizError } = await serviceClient
      .from("businesses").select("id, name, owner_user_id").eq("id", businessId).maybeSingle();
    if (bizError || !business) {
      return new Response(JSON.stringify({ error: "Consultorio no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute cascade delete in a single transaction via raw SQL through the DB URL
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    // Use pg from deno
    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(dbUrl, 1, true);
    const conn = await pool.connect();

    try {
      await conn.queryObject("BEGIN");

      // 1. scheduled_reminders
      await conn.queryObject("DELETE FROM public.scheduled_reminders WHERE business_id = $1", [businessId]);
      // 2. payments
      await conn.queryObject("DELETE FROM public.payments WHERE business_id = $1", [businessId]);
      // 3. appointment_requests (clinic_user_id = owner of business)
      await conn.queryObject("DELETE FROM public.appointment_requests WHERE clinic_user_id = $1", [business.owner_user_id]);
      // 4. appointments
      await conn.queryObject("DELETE FROM public.appointments WHERE business_id = $1", [businessId]);
      // 5. availability_slots
      await conn.queryObject("DELETE FROM public.availability_slots WHERE business_id = $1", [businessId]);
      // 6. patient_portal_invites (via patients)
      await conn.queryObject(
        "DELETE FROM public.patient_portal_invites WHERE patient_id IN (SELECT id FROM public.patients WHERE business_id = $1)",
        [businessId]
      );
      // 7. professional_portal_invites
      await conn.queryObject("DELETE FROM public.professional_portal_invites WHERE business_id = $1", [businessId]);
      // 8. patients
      await conn.queryObject("DELETE FROM public.patients WHERE business_id = $1", [businessId]);
      // 9. services
      await conn.queryObject("DELETE FROM public.services WHERE business_id = $1", [businessId]);
      // 10. clinic_settings (user_id = owner)
      await conn.queryObject("DELETE FROM public.clinic_settings WHERE user_id = $1", [business.owner_user_id]);
      // 11. subscriptions
      await conn.queryObject("DELETE FROM public.subscriptions WHERE business_id = $1", [businessId]);
      // 12. user_roles
      await conn.queryObject("DELETE FROM public.user_roles WHERE business_id = $1", [businessId]);
      // 13. business itself
      await conn.queryObject("DELETE FROM public.businesses WHERE id = $1", [businessId]);

      await conn.queryObject("COMMIT");
    } catch (txError) {
      await conn.queryObject("ROLLBACK");
      throw txError;
    } finally {
      conn.release();
      await pool.end();
    }

    return new Response(
      JSON.stringify({ success: true, message: `Consultorio "${business.name}" eliminado completamente` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error deleting business:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error inesperado al eliminar" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

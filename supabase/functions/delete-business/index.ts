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

    const body = await req.json().catch(() => ({}));
    const { businessId, deleteOwnerAuthUser = true } = body as {
      businessId?: string;
      deleteOwnerAuthUser?: boolean;
    };
    if (!businessId) {
      return new Response(JSON.stringify({ error: "businessId es requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify business exists
    const { data: business, error: bizError } = await serviceClient
      .from("businesses")
      .select("id, name, owner_user_id, portal_logo_url, dashboard_logo_url")
      .eq("id", businessId)
      .maybeSingle();
    if (bizError || !business) {
      return new Response(JSON.stringify({ error: "Consultorio no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- 1) Collect storage paths to clean up AFTER tx commits ----
    // Patient documents files
    const { data: docs } = await serviceClient
      .from("patient_documents")
      .select("file_path")
      .eq("business_id", businessId);
    const patientDocPaths = (docs ?? []).map((d) => d.file_path).filter(Boolean) as string[];

    // Clinic settings logo / cover (owner's row)
    const { data: clinicSettings } = await serviceClient
      .from("clinic_settings")
      .select("logo_url, cover_image_url")
      .eq("user_id", business.owner_user_id)
      .maybeSingle();

    // Helper: parse a storage public URL or path into { bucket, path }
    const parseStorageRef = (url: string | null | undefined): { bucket: string; path: string } | null => {
      if (!url) return null;
      // Match /storage/v1/object/(public|sign)/{bucket}/{path}
      const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/);
      if (m) return { bucket: m[1], path: decodeURIComponent(m[2]) };
      return null;
    };

    const avatarRefs: string[] = [];
    for (const u of [business.portal_logo_url, business.dashboard_logo_url, clinicSettings?.logo_url, clinicSettings?.cover_image_url]) {
      const ref = parseStorageRef(u);
      if (ref?.bucket === "avatars") avatarRefs.push(ref.path);
    }

    // ---- 2) Transactional DB delete ----
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;
    const { Pool } = await import("https://deno.land/x/postgres@v0.19.3/mod.ts");
    const pool = new Pool(dbUrl, 1, true);
    const conn = await pool.connect();

    let ownerEmailForLog: string | null = null;

    try {
      await conn.queryObject("BEGIN");

      // Children of patients first
      await conn.queryObject(
        "DELETE FROM public.patient_portal_invites WHERE patient_id IN (SELECT id FROM public.patients WHERE business_id = $1)",
        [businessId],
      );
      await conn.queryObject("DELETE FROM public.patient_documents WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.session_notes WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.scheduled_reminders WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.payments WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.appointment_requests WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.appointments WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.availability_slots WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.availability_templates WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.professional_portal_invites WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.payment_policies WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.push_subscriptions WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.patients WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.services WHERE business_id = $1", [businessId]);
      // clinic_settings: belongs to owner. Only delete if owner has no other businesses.
      const otherBizRes = await conn.queryObject<{ cnt: bigint }>(
        "SELECT COUNT(*)::bigint AS cnt FROM public.businesses WHERE owner_user_id = $1 AND id <> $2",
        [business.owner_user_id, businessId],
      );
      const ownerHasOtherBusinesses = Number(otherBizRes.rows[0]?.cnt ?? 0n) > 0;
      if (!ownerHasOtherBusinesses) {
        await conn.queryObject("DELETE FROM public.clinic_settings WHERE user_id = $1", [business.owner_user_id]);
      }
      await conn.queryObject("DELETE FROM public.subscriptions WHERE business_id = $1", [businessId]);
      await conn.queryObject("DELETE FROM public.user_roles WHERE business_id = $1", [businessId]);
      // pending_business_activations by owner email
      const ownerEmailRes = await conn.queryObject<{ email: string | null }>(
        "SELECT email FROM public.profiles WHERE id = $1",
        [business.owner_user_id],
      );
      ownerEmailForLog = ownerEmailRes.rows[0]?.email ?? null;
      if (ownerEmailForLog) {
        await conn.queryObject(
          "DELETE FROM public.pending_business_activations WHERE owner_email = $1",
          [ownerEmailForLog],
        );
      }
      // Business itself
      await conn.queryObject("DELETE FROM public.businesses WHERE id = $1", [businessId]);

      // Profile + super_admin-aware owner cleanup decisions happen post-commit.
      await conn.queryObject("COMMIT");
    } catch (txError) {
      await conn.queryObject("ROLLBACK");
      throw txError;
    } finally {
      conn.release();
      await pool.end();
    }

    // ---- 3) Storage cleanup (best-effort, post-commit) ----
    const storageWarnings: string[] = [];
    if (patientDocPaths.length > 0) {
      const { error: docDelError } = await serviceClient.storage
        .from("patient-documents")
        .remove(patientDocPaths);
      if (docDelError) storageWarnings.push(`patient-documents: ${docDelError.message}`);
    }
    if (avatarRefs.length > 0) {
      const { error: avDelError } = await serviceClient.storage
        .from("avatars")
        .remove(avatarRefs);
      if (avDelError) storageWarnings.push(`avatars: ${avDelError.message}`);
    }

    // ---- 4) Owner auth.user cleanup (only if requested AND owner has no other businesses AND not super_admin AND not the caller) ----
    let ownerDeleted = false;
    let ownerSkippedReason: string | null = null;
    let ownerOtherBusinesses = 0;

    if (deleteOwnerAuthUser) {
      if (business.owner_user_id === user.id) {
        ownerSkippedReason = "El owner es el super_admin que ejecuta la operación";
      } else {
        // Check other businesses again post-commit (defensive)
        const { count: otherBizCount } = await serviceClient
          .from("businesses")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", business.owner_user_id);

        const { data: ownerIsSuper } = await serviceClient.rpc("is_super_admin", { _user_id: business.owner_user_id });

        ownerOtherBusinesses = otherBizCount ?? 0;
        if (ownerOtherBusinesses > 0) {
          ownerSkippedReason = "El owner tiene otros consultorios activos";
        } else if (ownerIsSuper) {
          ownerSkippedReason = "El owner es super_admin";
        } else {
          // Delete profile row first (no FK, but keeps things clean), then auth user
          await serviceClient.from("profiles").delete().eq("id", business.owner_user_id);
          await serviceClient.from("user_roles").delete().eq("user_id", business.owner_user_id);
          await serviceClient.from("push_subscriptions").delete().eq("user_id", business.owner_user_id);

          const { error: authDelError } = await serviceClient.auth.admin.deleteUser(business.owner_user_id);
          if (authDelError) {
            ownerSkippedReason = `No se pudo eliminar auth.user: ${authDelError.message}`;
          } else {
            ownerDeleted = true;
          }
        }
      }
    } else {
      ownerSkippedReason = "deleteOwnerAuthUser=false";
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Consultorio "${business.name}" eliminado completamente`,
        owner_email: ownerEmailForLog,
        owner_auth_user_deleted: ownerDeleted,
        owner_skipped_reason: ownerSkippedReason,
        owner_other_businesses: ownerOtherBusinesses,
        storage_warnings: storageWarnings,
      }),
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
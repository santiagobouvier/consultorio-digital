// Generic email sender via Resend API
// Templates: appointment_confirmation, appointment_reminder, patient_invite,
// business_activation, raw. La lógica (autorización + plantillas) vive en
// handler.ts; acá solo se conectan el entorno y Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHandler, DEFAULT_BRANDING, type BrandingInfo } from "./handler.ts";

// Sender: usa RESEND_FROM_EMAIL si está configurado (ej: "Consultorio Digital
// <noreply@consultoriodigital.app>" una vez verificado el dominio en Resend).
// Mientras el dominio no esté verificado, Resend responde 403; el fallback
// onboarding@resend.dev solo entrega al email dueño de la cuenta Resend.
const FROM_EMAIL =
  Deno.env.get("RESEND_FROM_EMAIL") || "Consultorio Digital <onboarding@resend.dev>";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function getBranding(businessId: string | undefined): Promise<BrandingInfo> {
  if (!businessId) return DEFAULT_BRANDING;
  try {
    const { data } = await admin
      .from("businesses")
      .select("name, dashboard_display_name, portal_clinic_display_name, dashboard_logo_url, portal_logo_url, dashboard_primary_color, portal_primary_color")
      .eq("id", businessId)
      .maybeSingle();
    if (!data) return DEFAULT_BRANDING;
    return {
      name: data.portal_clinic_display_name || data.dashboard_display_name || data.name || DEFAULT_BRANDING.name,
      logoUrl: data.portal_logo_url || data.dashboard_logo_url || null,
      primaryColor: data.portal_primary_color || data.dashboard_primary_color || DEFAULT_BRANDING.primaryColor,
    };
  } catch (e) {
    console.error("Error loading branding:", e);
    return DEFAULT_BRANDING;
  }
}

// JWT de usuario → id. La anon key también es un JWT del proyecto, pero no
// tiene `sub`: getUser() falla y el llamador queda como no autenticado.
async function getUserIdFromToken(token: string): Promise<string | null> {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

// Misma regla que las políticas RLS: dueño, miembro (user_roles) o super admin.
async function userBelongsToBusiness(userId: string, businessId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("user_belongs_to_business", {
    _user_id: userId,
    _business_id: businessId,
  });
  if (error) {
    console.error("user_belongs_to_business failed:", error);
    return false;
  }
  return data === true;
}

Deno.serve(
  createHandler({
    serviceRoleKey: SERVICE_ROLE,
    resendApiKey: RESEND_API_KEY,
    fromEmail: FROM_EMAIL,
    getUserIdFromToken,
    userBelongsToBusiness,
    getBranding,
    fetch: (input, init) => fetch(input, init),
  }),
);

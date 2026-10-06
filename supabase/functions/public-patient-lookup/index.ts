// Consultorios del paciente logueado. La lógica (autorización) vive en
// handler.ts; acá solo se conectan el entorno y Supabase.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLookupHandler, type PatientClinic } from "./handler.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function getUserIdFromToken(token: string): Promise<string | null> {
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

async function listClinicsForUser(userId: string): Promise<PatientClinic[]> {
  const { data: patients, error } = await admin
    .from("patients")
    .select("business_id")
    .eq("auth_user_id", userId)
    .eq("is_active", true);
  if (error) throw error;

  const businessIds = [...new Set((patients ?? []).map((p) => p.business_id))];
  if (businessIds.length === 0) return [];

  // Solo datos públicos del consultorio
  const { data: businesses, error: bizError } = await admin
    .from("businesses")
    .select("public_slug, name, specialty, portal_logo_url, portal_clinic_display_name")
    .in("id", businessIds)
    .eq("is_active", true);
  if (bizError) throw bizError;

  return (businesses ?? []).map((b) => ({
    slug: b.public_slug,
    name: b.portal_clinic_display_name || b.name,
    specialty: b.specialty,
    logo_url: b.portal_logo_url,
  }));
}

Deno.serve(createLookupHandler({ getUserIdFromToken, listClinicsForUser }));

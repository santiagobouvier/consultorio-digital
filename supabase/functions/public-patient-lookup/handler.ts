// Lógica de public-patient-lookup separada del runtime (sin Deno.env ni
// supabase-js) para probarla sin red.
//
// Devuelve los consultorios donde el usuario LOGUEADO es paciente activo.
// Ya no busca por un email enviado por el cliente: sin sesión válida no
// responde nada, así que nadie puede averiguar dónde se atiende otra persona.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface PatientClinic {
  slug: string;
  name: string;
  specialty: string | null;
  logo_url: string | null;
}

export interface LookupDeps {
  /** JWT de usuario → su id; null si no es un usuario válido (la anon key cae acá). */
  getUserIdFromToken: (token: string) => Promise<string | null>;
  /** Consultorios activos donde ese usuario es paciente activo (patients.auth_user_id). */
  listClinicsForUser: (userId: string) => Promise<PatientClinic[]>;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bearerToken(req: Request): string {
  const m = /^Bearer\s+(.+)$/i.exec((req.headers.get("authorization") ?? "").trim());
  return m ? m[1].trim() : "";
}

export function createLookupHandler(deps: LookupDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const token = bearerToken(req);
    let userId: string | null = null;
    if (token) {
      try {
        userId = await deps.getUserIdFromToken(token);
      } catch {
        userId = null;
      }
    }
    if (!userId) return json({ error: "unauthorized" }, 401);

    try {
      // El cuerpo (por ejemplo un "email") se ignora a propósito: la
      // identidad sale solo de la sesión.
      const clinics = await deps.listClinicsForUser(userId);
      return json({ clinics }, 200);
    } catch (err) {
      console.error("public-patient-lookup error:", err);
      return json({ error: "Error interno" }, 500);
    }
  };
}

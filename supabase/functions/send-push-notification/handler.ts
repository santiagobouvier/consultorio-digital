// Autorización y armado del aviso de send-push-notification, separados del
// runtime (sin Deno.env, supabase-js ni cifrado) para probarlos sin red.
//
// Quién puede mandar un push y a quién:
//   1. El backend (edge functions con la service role exacta): a cualquier
//      usuario. Es el camino de la reserva pública, el webhook de Mercado
//      Pago y el resumen diario.
//   2. Un usuario logueado (panel del profesional): solo a un PACIENTE de un
//      consultorio al que pertenece (dueño, miembro o superadmin). El link
//      queda dentro de la app y el ícono es el de la app.
// Todo lo demás (sin header, anon key, token inválido, destinatario ajeno)
// se rechaza antes de buscar dispositivos o enviar nada.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const APP_ORIGIN = "https://consultoriodigital.app";
const DEFAULT_ICON = "/app-icon.svg";
const MAX_TITLE = 120;
const MAX_BODY = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PushPayload {
  title: string;
  body: string;
  icon: string;
  data: { url: string };
}

export interface DeliveryResult {
  sent: number;
  total: number;
  cleaned: number;
}

export interface PushDeps {
  serviceRoleKey: string;
  /** JWT de usuario → su id; null si no es un usuario válido (la anon key cae acá). */
  getUserIdFromToken: (token: string) => Promise<string | null>;
  /** ¿El usuario destino es paciente activo de algún consultorio al que pertenece el que envía? */
  isPatientOfCallerBusiness: (callerId: string, targetUserId: string) => Promise<boolean>;
  /** Envía a los dispositivos registrados del destino (cifrado Web Push). */
  deliver: (targetUserId: string, payload: PushPayload) => Promise<DeliveryResult>;
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

function secretEquals(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** Link del aviso enviado por un usuario: solo rutas de la propia app. */
export function sanitizeUserUrl(url: unknown): string {
  if (typeof url !== "string" || !url.trim()) return "/";
  const u = url.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    const parsed = new URL(u);
    if (parsed.origin === APP_ORIGIN) return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    /* no es una URL válida */
  }
  return "/";
}

type Caller = { kind: "service" } | { kind: "user"; userId: string };

export function createPushHandler(deps: PushDeps): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
      const token = bearerToken(req);
      let caller: Caller | null = null;
      if (token && secretEquals(token, deps.serviceRoleKey)) {
        caller = { kind: "service" };
      } else if (token) {
        try {
          const userId = await deps.getUserIdFromToken(token);
          if (userId) caller = { kind: "user", userId };
        } catch {
          caller = null;
        }
      }
      if (!caller) return json({ error: "unauthorized" }, 401);

      const { user_id, title, body: notifBody, icon, url } = await req.json().catch(() => ({}));
      if (!user_id || !title || !notifBody) {
        return json({ error: "Missing user_id, title or body" }, 400);
      }
      if (typeof user_id !== "string" || !UUID_RE.test(user_id)) {
        return json({ error: "invalid_user_id" }, 400);
      }

      if (caller.kind === "user") {
        let allowed = false;
        try {
          allowed = await deps.isPatientOfCallerBusiness(caller.userId, user_id);
        } catch (e) {
          console.error("isPatientOfCallerBusiness failed:", e);
        }
        if (!allowed) return json({ error: "forbidden" }, 403);
      }

      const payload: PushPayload = {
        title: String(title).slice(0, MAX_TITLE),
        body: String(notifBody).slice(0, MAX_BODY),
        icon: caller.kind === "service" && typeof icon === "string" && icon ? icon : DEFAULT_ICON,
        data: {
          url: caller.kind === "service"
            ? (typeof url === "string" && url ? url : "/")
            : sanitizeUserUrl(url),
        },
      };

      const result = await deps.deliver(user_id, payload);
      if (result.total === 0) return json({ sent: 0, message: "No subscriptions found" }, 200);
      return json(result, 200);
    } catch (err) {
      console.error("send-push-notification error:", err);
      return json({ error: String(err) }, 500);
    }
  };
}

// Quién puede disparar las tareas automáticas de avisos
// (process-scheduled-reminders y daily-agenda-summary). Copia idéntica en las
// dos carpetas (Lovable despliega cada función por separado); una prueba
// verifica que sigan iguales.
//
// Antes aceptaban cualquier llamada (verify_jwt = false y sin chequeo), así
// que cualquiera con la anon key pública podía forzar envíos. Ahora solo:
//  - el servidor: Bearer <SUPABASE_SERVICE_ROLE_KEY> (p. ej. el "empujón" de
//    public-book-appointment);
//  - pg_cron: Bearer <cron_jobs_token>, un token propio guardado en Vault que
//    la función no lee: le pregunta a la base si es el vigente
//    (verify_cron_jobs_token → boolean, solo service_role). Mismo patrón que
//    portal_notify_token (CD-001).

export interface CronAuthDeps {
  serviceRoleKey: string;
  /** Pregunta a la base si el token es el vigente. Lanza si la consulta falla. */
  verifyCronToken(token: string): Promise<boolean>;
}

const CRON_TOKEN_FORMAT = /^[0-9a-f]{64}$/;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function bearerToken(authHeader: string | null): string | null {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(authHeader ?? "");
  return m ? m[1] : null;
}

export async function isAuthorizedCronCaller(authHeader: string | null, deps: CronAuthDeps): Promise<boolean> {
  const token = bearerToken(authHeader);
  if (!token) return false;
  if (deps.serviceRoleKey && timingSafeEqual(token, deps.serviceRoleKey)) return true;
  if (!CRON_TOKEN_FORMAT.test(token)) return false;
  try {
    return await deps.verifyCronToken(token);
  } catch {
    return false;
  }
}

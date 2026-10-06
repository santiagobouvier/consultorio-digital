// Recuperación de contraseña: lectura del enlace y decisiones de la pantalla
// /reset-password. Puro (sin imports): no consulta ni modifica nada.

export interface RecoveryUrlParams {
  /** El enlace trajo tokens de sesión (#access_token=…). */
  hasAccessToken: boolean;
  /** Enlace con token_hash (plantillas de mail que apuntan directo a la app). */
  tokenHash: string | null;
  type: string | null;
  /** Enlace PKCE (?code=…). */
  code: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
}

/** Lee los parámetros del enlace, del query y del #hash. Nunca los registra. */
export function readRecoveryParams(href: string): RecoveryUrlParams {
  const url = new URL(href);
  const merged = new URLSearchParams(url.search);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  for (const [k, v] of new URLSearchParams(hash)) merged.set(k, v);
  const get = (k: string) => merged.get(k) || null;
  return {
    hasAccessToken: !!get("access_token"),
    tokenHash: get("token_hash"),
    type: get("type"),
    code: get("code"),
    error: get("error"),
    errorCode: get("error_code"),
    errorDescription: get("error_description"),
  };
}

export type RecoveryFailure = "expired" | "invalid" | "missing";

/**
 * Por qué no hay sesión de recuperación.
 * - expired: el enlace venció o ya se usó (Supabase devuelve otp_expired).
 * - invalid: el enlace trajo otro error.
 * - missing: se abrió /reset-password sin enlace, o la sesión ya no está.
 */
export function classifyRecoveryFailure(
  params: RecoveryUrlParams,
  errorCode?: string | null,
  errorMessage?: string | null,
): RecoveryFailure {
  const code = (errorCode || params.errorCode || "").toLowerCase();
  const text = `${errorMessage || ""} ${params.errorDescription || ""}`.toLowerCase();
  if (code === "otp_expired" || code === "flow_state_expired" || /expired|invalid or has expired/.test(text)) {
    return "expired";
  }
  if (code || params.error || params.errorDescription || errorMessage) return "invalid";
  if (params.hasAccessToken || params.tokenHash || params.code) return "invalid";
  return "missing";
}

export type UpdatePasswordError = "session" | "weak" | "same" | "other";

export function classifyUpdateError(error: { name?: string; code?: string; message?: string } | null | undefined): UpdatePasswordError {
  const code = (error?.code || "").toLowerCase();
  const text = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();
  if (code === "session_not_found" || text.includes("session missing") || text.includes("authsessionmissing")) return "session";
  if (code === "same_password" || text.includes("different from the old")) return "same";
  if (code === "weak_password" || text.includes("weak") || text.includes("at least")) return "weak";
  return "other";
}

export interface ReturnClinic {
  slug: string;
  name: string;
}

export type RecoveryReturn =
  | { kind: "path"; path: string; label: string }
  | { kind: "choose"; clinics: ReturnClinic[] };

/**
 * Adónde va cada uno después de cambiar la contraseña (ya con sesión):
 * superadmin → panel admin; profesional → su panel; paciente → su portal
 * (o elige si tiene varios); si no se pudo determinar → pantalla de acceso.
 */
export function decideRecoveryReturn(input: {
  isSuperAdmin: boolean;
  isProfessional: boolean;
  clinics: ReturnClinic[] | null;
}): RecoveryReturn {
  if (input.isSuperAdmin) return { kind: "path", path: "/saas-admin", label: "Ir al panel" };
  if (input.isProfessional) return { kind: "path", path: "/dashboard", label: "Ir a mi consultorio" };
  const clinics = (input.clinics ?? []).filter((c) => !!c.slug);
  if (clinics.length === 1) return { kind: "path", path: `/portal/${clinics[0].slug}`, label: "Ir a mi portal" };
  if (clinics.length > 1) return { kind: "choose", clinics };
  return { kind: "path", path: "/acceso", label: "Ir a ingresar" };
}

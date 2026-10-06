// Adónde mandar al paciente después de iniciar sesión en /acceso/paciente.
// Puro: no consulta ni modifica nada.

export interface AccessClinic {
  slug: string;
  name: string;
}

export type PatientAccessResult =
  | { kind: "redirect"; path: string }
  | { kind: "choose" }
  | { kind: "none" };

export function resolvePatientAccess(clinics: AccessClinic[] | null | undefined): PatientAccessResult {
  const valid = (clinics ?? []).filter((c) => !!c.slug);
  if (valid.length === 0) return { kind: "none" };
  if (valid.length === 1) return { kind: "redirect", path: `/portal/${valid[0].slug}` };
  return { kind: "choose" };
}

export type ExistingSessionResult =
  | { kind: "redirect"; path: string }
  | { kind: "choose" }
  /** Sesión de profesional o superadmin sin portal de paciente: se ofrece su panel. */
  | { kind: "staff"; path: string }
  /** Sesión sin portal de paciente ni panel. */
  | { kind: "no-portal" };

/**
 * Qué hacer al abrir /acceso/paciente con una sesión ya iniciada. Primero
 * cuenta lo de paciente (sus propios consultorios); recién si no tiene, se
 * reconoce el rol de profesional. Nunca se cierra la sesión sin pedirlo.
 */
export function decideExistingSession(
  clinics: AccessClinic[] | null | undefined,
  staffPath: string | null,
): ExistingSessionResult {
  const patient = resolvePatientAccess(clinics);
  if (patient.kind !== "none") return patient;
  return staffPath ? { kind: "staff", path: staffPath } : { kind: "no-portal" };
}

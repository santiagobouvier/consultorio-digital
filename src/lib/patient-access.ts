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

// Perfil de paciente v2: tipos de dominio que espejan los CHECK constraints
// de la base (text + CHECK en Postgres, union types acá — no hay enums de PG).
//
// Los campos clínicos sensibles (medicación, diagnóstico, antecedentes,
// riesgo, estado del tratamiento) viven en la tabla `patient_clinical_status`,
// que NO tiene ninguna política RLS para pacientes: solo la lee el
// profesional a cargo. Nunca importar ni consultar esa tabla desde el portal
// del paciente ni desde rutas públicas.

export type PaymentType = "particular" | "convenio";
export type AgreedFrequency = "semanal" | "quincenal" | "mensual" | "sin_frecuencia";
export type TreatmentStatus = "activo" | "en_pausa" | "alta" | "abandono";
export type RiskFlag = "ninguno" | "seguimiento" | "riesgo_alto";

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  particular: "Particular",
  convenio: "Convenio / mutualista",
};

export const AGREED_FREQUENCY_LABELS: Record<AgreedFrequency, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  sin_frecuencia: "Sin frecuencia fija",
};

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  activo: "En tratamiento",
  en_pausa: "En pausa",
  alta: "Alta",
  abandono: "Abandono",
};

export const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  ninguno: "Sin riesgo señalado",
  seguimiento: "Requiere seguimiento",
  riesgo_alto: "Riesgo alto",
};

/** Estado clínico del paciente (fila de patient_clinical_status). */
export interface ClinicalStatus {
  patient_id: string;
  business_id: string;
  treatment_status: TreatmentStatus | null;
  current_medication: string | null;
  current_diagnosis: string | null;
  medical_history: string | null;
  risk_flag: RiskFlag;
  risk_notes: string | null;
  updated_at: string;
}

/** Edad en años cumplidos a partir de una fecha ISO (yyyy-mm-dd), o null. */
export function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/** Menor de 18: dispara la sección de adulto responsable en la ficha. */
export function isMinor(birthDate: string | null | undefined): boolean {
  const age = computeAge(birthDate);
  return age !== null && age < 18;
}

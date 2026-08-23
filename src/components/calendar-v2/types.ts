import { type PaymentStatus } from "@/lib/payments";

export interface Professional {
  id: string;
  name: string;
  color: string;
  userId: string;
}

export interface CalendarAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  modality: "online" | "in_person" | null;
  location: string | null;
  payment_status: string | null;
  patient_id: string | null;
  service_id: string | null;
  professional_id: string | null;
  patients: { full_name: string; avatar_url?: string | null } | null;
  services: { name: string } | null;
  professional?: Professional | null;
  paymentColor?: PaymentColor;
  patientPaymentStatus?: PaymentStatus;
  recurrence_group_id?: string | null;
  /** Evento personal del profesional (no es una cita): se dibuja distinto
   *  y al tocarlo abre su propio modal. */
  isPersonal?: boolean;
  personalEvent?: PersonalEvent;
}

/** Fila cruda de personal_events (bloquea la reserva online). */
export interface PersonalEvent {
  id: string;
  business_id: string;
  professional_user_id: string;
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string;
  recurrence: "none" | "weekly";
  recurrence_until: string | null;
  category?: string | null;
  label_id?: string | null;
  /** Etiqueta custom (join de personal_event_labels); pisa a category. */
  personal_event_labels?: { name: string; color: string } | null;
}

/** Etiqueta personalizada creada por el profesional. */
export interface PersonalEventLabel {
  id: string;
  name: string;
  color: string;
}

/** Paleta fija para etiquetas custom (los colores de Google Calendar). */
export const LABEL_PALETTE = [
  "#d50000", "#e67c73", "#f4511e", "#f6bf26",
  "#33b679", "#0b8043", "#009688", "#039be5",
  "#3f51b5", "#7986cb", "#8e24aa", "#ad1457",
  "#c0ca33", "#f09300", "#795548", "#616161",
];

/** Etiquetas FIJAS de eventos personales, cada una con su color estable
 *  (mismo lenguaje que Google Calendar: el color identifica la etiqueta). */
export type PersonalCategory =
  | "personal"
  | "salud"
  | "familia"
  | "tramite"
  | "ejercicio"
  | "estudio"
  | "descanso";

export const PERSONAL_CATEGORIES: { id: PersonalCategory; label: string; color: string }[] = [
  { id: "personal", label: "Personal", color: "#64748b" },
  { id: "salud", label: "Salud", color: "#f43f5e" },
  { id: "familia", label: "Familia", color: "#f59e0b" },
  { id: "tramite", label: "Trámite", color: "#8b5cf6" },
  { id: "ejercicio", label: "Ejercicio", color: "#22c55e" },
  { id: "estudio", label: "Estudio", color: "#3b82f6" },
  { id: "descanso", label: "Descanso", color: "#06b6d4" },
];

export const getPersonalCategory = (id?: string | null) =>
  PERSONAL_CATEGORIES.find((c) => c.id === id) ?? PERSONAL_CATEGORIES[0];

/** Etiqueta efectiva de un evento personal: la custom si tiene, si no la fija. */
export const getPersonalLabel = (
  ev?: PersonalEvent | null
): { label: string; color: string } => {
  if (ev?.personal_event_labels) {
    return { label: ev.personal_event_labels.name, color: ev.personal_event_labels.color };
  }
  const cat = getPersonalCategory(ev?.category);
  return { label: cat.label, color: cat.color };
};

/** Colores sólidos por estado (para bloques/barritas cuando no se colorea
 *  por profesional). */
const STATUS_HEX: Record<string, string> = {
  pending: "#f59e0b",
  reschedule_requested: "#eab308",
  confirmed: "#00b5b5",
  scheduled: "#00b5b5",
  attended: "#94a3b8",
  no_show: "#f87171",
};

/** Color hex del evento, con una sola regla en toda la agenda:
 *  etiqueta personal → profesional (agenda compartida) → estado. */
export const getEventHexColor = (
  apt: CalendarAppointment,
  showProfessionalColors: boolean
): string => {
  if (apt.isPersonal) return getPersonalLabel(apt.personalEvent).color;
  if (showProfessionalColors && apt.professional) return apt.professional.color;
  return STATUS_HEX[apt.status] ?? "#00b5b5";
};

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "attended"
  | "cancelled"
  | "cancelled_by_patient"
  | "reschedule_requested"
  | "scheduled"
  | "no_show"
  | "personal";
export type PaymentColor = "green" | "orange" | "red" | "gray";
export type ViewType = "day" | "week" | "month";

export interface DayPayment {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string | null;
  patient_avatar_url?: string | null;
  due_date: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  method: string | null;
  notes: string | null;
}

export interface CalendarFilters {
  professionalId: string | null;
  patientId: string | null;
  status: AppointmentStatus | "all";
  paymentStatus: "all" | "al_dia" | "por_vencer" | "vencido";
}

export const APPOINTMENT_STATUS_MAP: Record<AppointmentStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Programada", variant: "default" },
  confirmed: { label: "Confirmada", variant: "default" },
  attended: { label: "Realizada", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  cancelled_by_patient: { label: "Cancelada por paciente", variant: "destructive" },
  reschedule_requested: { label: "Reprogramación pedida", variant: "outline" },
  scheduled: { label: "Confirmada", variant: "default" },
  no_show: { label: "Ausente", variant: "destructive" },
  personal: { label: "Personal", variant: "secondary" },
};

export const PROFESSIONAL_COLORS = [
  "#00b5b5", // Teal (primary)
  "#f97316", // Orange
  "#8b5cf6", // Purple
  "#22c55e", // Green
  "#ec4899", // Pink
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#ef4444", // Red
];

export const getStatusLabel = (status: AppointmentStatus): string => {
  return APPOINTMENT_STATUS_MAP[status]?.label || status;
};

export const getPaymentColorInfo = (color?: PaymentColor) => {
  switch (color) {
    case "green":
      return { label: "Al día", className: "bg-emerald-500" };
    case "orange":
      return { label: "Por vencer", className: "bg-amber-500" };
    case "red":
      return { label: "Vencido", className: "bg-rose-500" };
    default:
      return null;
  }
};

/**
 * Color por status de la cita, usado como borde lateral / acento.
 * Independiente del color de pago (que va como dot informativo).
 */
export const getStatusColor = (status: AppointmentStatus): {
  border: string;        // tailwind class for border-l color
  bgTint: string;        // soft background tint
  swatch: string;        // solid bg color for dots/badges
} => {
  switch (status) {
    case "personal":
      return { border: "border-l-slate-400", bgTint: "bg-slate-100/70 dark:bg-slate-500/10", swatch: "bg-slate-400" };
    case "pending":
      return { border: "border-l-amber-500", bgTint: "bg-amber-50 dark:bg-amber-500/10", swatch: "bg-amber-500" };
    case "reschedule_requested":
      return { border: "border-l-yellow-400", bgTint: "bg-yellow-50 dark:bg-yellow-500/10", swatch: "bg-yellow-400" };
    case "cancelled_by_patient":
      return { border: "border-l-rose-500", bgTint: "bg-rose-50 dark:bg-rose-500/10", swatch: "bg-rose-500" };
    case "cancelled":
    case "attended":
    case "no_show":
      return { border: "border-l-muted-foreground/40", bgTint: "bg-muted/40", swatch: "bg-muted-foreground/40" };
    case "scheduled":
    case "confirmed":
    default:
      return { border: "border-l-primary", bgTint: "bg-primary/10", swatch: "bg-primary" };
  }
};

/**
 * Abrevia un nombre completo a "Nombre I." para que entre en celdas estrechas.
 * No usa ellipsis: corta de forma legible.
 */
export const abbreviatePatientName = (fullName?: string | null): string => {
  if (!fullName) return "Sin nombre";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
};

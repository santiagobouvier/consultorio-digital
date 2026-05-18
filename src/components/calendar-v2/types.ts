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
}

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "attended"
  | "cancelled"
  | "cancelled_by_patient"
  | "reschedule_requested"
  | "scheduled"
  | "no_show";
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

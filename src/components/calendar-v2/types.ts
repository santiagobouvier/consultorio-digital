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
  patients: { full_name: string } | null;
  services: { name: string } | null;
  professional?: Professional | null;
  paymentColor?: PaymentColor;
  patientPaymentStatus?: PaymentStatus;
}

export type AppointmentStatus = "pending" | "confirmed" | "attended" | "cancelled" | "no_show";
export type PaymentColor = "green" | "orange" | "red" | "gray";
export type ViewType = "day" | "week" | "month";

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

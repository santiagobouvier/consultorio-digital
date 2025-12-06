// Helper functions for payment status calculation
import { addMonths, addYears, setDate, getDaysInMonth } from "date-fns";

export type PaymentStatus = 'pending' | 'due_soon' | 'overdue' | 'paid' | 'cancelled';
export type RecurrenceType = 'one_time' | 'monthly' | 'yearly';

export interface Payment {
  id: string;
  business_id: string;
  patient_id: string;
  appointment_id: string | null;
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  status: PaymentStatus;
  method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  recurrence_type: RecurrenceType;
  anchor_day: number | null;
  patients?: {
    full_name: string;
  };
}

/**
 * Calculate the real-time status of a payment based on due_date and paid_at
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function calculatePaymentStatus(payment: { due_date: string; paid_at: string | null; status: string }): PaymentStatus {
  // If manually cancelled, keep it
  if (payment.status === 'cancelled') {
    return 'cancelled';
  }
  
  // If paid, it's paid
  if (payment.paid_at) {
    return 'paid';
  }
  
  const now = new Date();
  const dueDate = new Date(payment.due_date);
  
  // Calculate days until due
  const timeDiff = dueDate.getTime() - now.getTime();
  const daysUntilDue = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  
  if (daysUntilDue < 0) {
    return 'overdue';
  } else if (daysUntilDue <= 4) {
    return 'due_soon';
  } else {
    return 'pending';
  }
}

/**
 * Get the display color for a payment status
 */
export function getPaymentStatusColor(status: PaymentStatus): string {
  switch (status) {
    case 'overdue':
      return 'bg-destructive text-destructive-foreground';
    case 'due_soon':
      return 'bg-orange-500 text-white';
    case 'paid':
      return 'bg-green-600 text-white';
    case 'cancelled':
      return 'bg-muted text-muted-foreground';
    case 'pending':
    default:
      return 'bg-secondary text-secondary-foreground';
  }
}

/**
 * Get the display label for a payment status
 */
export function getPaymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'overdue':
      return 'Vencido';
    case 'due_soon':
      return 'Por vencer';
    case 'paid':
      return 'Pagado';
    case 'cancelled':
      return 'Cancelado';
    case 'pending':
    default:
      return 'Pendiente';
  }
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'UYU'): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Payment methods available
 */
export const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'otro', label: 'Otro' },
];

/**
 * Recurrence types
 */
export const RECURRENCE_TYPES = [
  { value: 'one_time', label: 'Pago único' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
];

/**
 * Get recurrence type label
 */
export function getRecurrenceTypeLabel(type: RecurrenceType): string {
  const found = RECURRENCE_TYPES.find(r => r.value === type);
  return found?.label || 'Pago único';
}

/**
 * Calculate next due date based on recurrence type
 */
export function calculateNextDueDate(
  currentDueDate: Date,
  recurrenceType: RecurrenceType,
  anchorDay?: number | null
): Date {
  const day = anchorDay || currentDueDate.getDate();
  
  let nextDate: Date;
  
  if (recurrenceType === 'monthly') {
    nextDate = addMonths(currentDueDate, 1);
  } else if (recurrenceType === 'yearly') {
    nextDate = addYears(currentDueDate, 1);
  } else {
    return currentDueDate; // one_time doesn't generate next date
  }
  
  // Adjust day to handle months with fewer days
  const daysInMonth = getDaysInMonth(nextDate);
  const adjustedDay = Math.min(day, daysInMonth);
  
  return setDate(nextDate, adjustedDay);
}

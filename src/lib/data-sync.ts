import type { QueryClient } from "@tanstack/react-query";

/**
 * Sincronizador central de caché: cuando cambia la PLATA (crear, cobrar,
 * editar, borrar o linkear un pago) hay varias pantallas que muestran esa
 * información con cachés propias. Invalidarlas TODAS acá evita el clásico
 * "borré el pago en Pagos pero la agenda lo sigue mostrando".
 *
 * Claves parciales: ["payments"] invalida ["payments", businessId] también.
 */
export function invalidatePaymentData(queryClient: QueryClient) {
  // Módulo Pagos
  queryClient.invalidateQueries({ queryKey: ["payments"] });
  // Chips de cobro de la agenda
  queryClient.invalidateQueries({ queryKey: ["calendar_payments"] });
  // Citas (payment_status embebido en la cita)
  queryClient.invalidateQueries({ queryKey: ["appointments"] });
  // Ficha de pacientes (próximas citas / deudas)
  queryClient.invalidateQueries({ queryKey: ["patients_appointments"] });
}

/**
 * Cuando cambia una CITA (crear, cancelar, reprogramar, marcar realizada)
 * también puede cambiar su cobro (triggers en la base los mantienen atados),
 * así que se invalida todo el conjunto.
 */
export function invalidateAppointmentData(queryClient: QueryClient) {
  invalidatePaymentData(queryClient);
  queryClient.invalidateQueries({ queryKey: ["appointment_requests"] });
  queryClient.invalidateQueries({ queryKey: ["reminders"] });
}

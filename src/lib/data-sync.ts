import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sincronización instantánea con Google Calendar: tras cualquier cambio de
 * citas se le pide al servidor que empuje lo pendiente. Con debounce para
 * agrupar ráfagas (ej: crear una serie recurrente) y fire-and-forget: si el
 * profesional no conectó Google, la función responde vacío y ya.
 */
let googleSyncTimer: number | undefined;
export function requestGoogleSync() {
  if (typeof window === "undefined") return;
  window.clearTimeout(googleSyncTimer);
  googleSyncTimer = window.setTimeout(() => {
    void supabase.functions
      .invoke("google-calendar-sync", { body: { action: "sync" } })
      .catch(() => {});
  }, 1500);
}

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
  // El espejo en Google Calendar se actualiza al toque (si está conectado)
  requestGoogleSync();
}

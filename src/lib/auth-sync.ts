/**
 * Coordinación de sesión entre pestañas vía BroadcastChannel.
 *
 * Dos canales separados para aislar el contexto profesional del paciente:
 *  - `auth-sync-pro`     → pestañas del panel profesional
 *  - `auth-sync-patient` → pestañas del portal del paciente
 *
 * NUNCA recarga la página. Las pestañas reaccionan actualizando su estado
 * interno (y opcionalmente navegando con react-router) en respuesta a los
 * mensajes.
 */

export type AuthSyncScope = "pro" | "patient";

export type AuthSyncMessage =
  | { type: "SIGNED_IN"; userId: string }
  | { type: "SIGNED_OUT" };

const CHANNEL_NAME: Record<AuthSyncScope, string> = {
  pro: "auth-sync-pro",
  patient: "auth-sync-patient",
};

export interface AuthSyncChannel {
  post: (msg: AuthSyncMessage) => void;
  onMessage: (handler: (msg: AuthSyncMessage) => void) => () => void;
  close: () => void;
}

/**
 * Crea un canal de sincronización para el scope dado.
 * Si el navegador no soporta BroadcastChannel, devuelve un no-op seguro.
 */
export const createAuthSyncChannel = (scope: AuthSyncScope): AuthSyncChannel => {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return {
      post: () => {},
      onMessage: () => () => {},
      close: () => {},
    };
  }

  const channel = new BroadcastChannel(CHANNEL_NAME[scope]);

  return {
    post: (msg) => {
      try {
        channel.postMessage(msg);
      } catch {
        // ignorar errores de serialización/canal cerrado
      }
    },
    onMessage: (handler) => {
      const listener = (event: MessageEvent<AuthSyncMessage>) => {
        if (!event?.data || typeof event.data.type !== "string") return;
        handler(event.data);
      };
      channel.addEventListener("message", listener);
      return () => channel.removeEventListener("message", listener);
    },
    close: () => {
      try {
        channel.close();
      } catch {
        // ignorar
      }
    },
  };
};

const PRO_ROUTE_PREFIXES = [
  "/dashboard",
  "/patients",
  "/appointments",
  "/agenda",
  "/centro-control",
  "/recordatorios-pendientes",
  "/mi-consultorio",
  "/horarios-disponibles",
  "/solicitudes",
  "/pagos",
  "/personalizar-portal",
  "/billing",
  "/estadisticas",
  "/saas-admin",
];

const PATIENT_ROUTE_PREFIXES = ["/portal/", "/portal-paciente"];

export const detectAuthScope = (pathname: string): AuthSyncScope | null => {
  if (PATIENT_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))) return "patient";
  if (PRO_ROUTE_PREFIXES.some((p) => pathname.startsWith(p))) return "pro";
  return null;
};
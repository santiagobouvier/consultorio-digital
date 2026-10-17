// Límite de reservas públicas: claves anónimas (HMAC) y decisión. La cuenta
// la lleva la base (register_public_booking_attempt, solo service_role); acá
// solo se arma la consulta. Se prueba con node:test (rate-limit_test.ts).

export interface RateLimitDeps {
  /** Secreto del servidor para el HMAC (no sale de la función). */
  secret: string;
  /** Llama a register_public_booking_attempt. Lanza si la consulta falla. */
  register(clientKey: string | null, businessId: string, phoneKey: string | null): Promise<string | null>;
  log?: (msg: string, extra?: unknown) => void;
}

/** IP del cliente según el proxy de Supabase (primer valor de x-forwarded-for). */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  const first = xff?.split(",")[0]?.trim();
  if (first) return first;
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

/** Solo dígitos: "+598 98 123 456" y "098123456" no son la misma clave, pero sí sin espacios ni guiones. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * null = se acepta; string = límite superado.
 * Si la base falla (p. ej. migración sin aplicar) NO se bloquea la reserva:
 * se registra el problema y se sigue.
 */
export async function checkPublicBookingRate(
  headers: Headers,
  businessId: string,
  phone: string,
  deps: RateLimitDeps,
): Promise<string | null> {
  const ip = clientIp(headers);
  const digits = normalizePhone(phone);
  const clientKey = ip ? await hmacHex(deps.secret, `ip:${ip}`) : null;
  const phoneKey = digits ? await hmacHex(deps.secret, `phone:${digits}`) : null;
  try {
    return await deps.register(clientKey, businessId, phoneKey);
  } catch (e) {
    deps.log?.("Límite de reservas no disponible; se acepta el intento", e instanceof Error ? e.message : e);
    return null;
  }
}

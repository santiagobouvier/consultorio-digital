// Descarga segura del link iCal que pega el profesional (SSRF).
//
// La función descarga desde el servidor una URL que escribe el usuario: sin
// controles, alguien podía apuntarla (directo o con una redirección) a
// direcciones internas: 169.254.169.254 (metadatos de la nube), localhost,
// redes privadas… Reglas:
//  - solo https y puerto 443;
//  - el host no puede ser "localhost", .local/.internal/.localhost, sin
//    punto, ni una IP privada, de loopback, link-local, CGNAT, multicast o
//    reservada (IPv4 o IPv6, incluidas las IPv4 mapeadas);
//  - si el runtime permite resolver DNS, todas las IP del dominio tienen que
//    ser públicas (riesgo residual: DNS rebinding entre la resolución y el
//    fetch);
//  - las redirecciones se siguen a mano (máx. 3) y cada salto se valida;
//  - tamaño máximo de respuesta y tiempo máximo.
// Sin dependencias de Deno: se prueba con node:test (url-guard_test.ts).

export const MAX_ICS_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

function isBlockedIPv4([a, b]: number[]): boolean {
  return (
    a === 0 || // "esta" red
    a === 10 || // privada
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local / metadatos
    (a === 172 && b >= 16 && b <= 31) || // privada
    (a === 192 && b === 168) || // privada
    (a === 192 && b === 0) || // IETF / TEST-NET-1 (192.0.0.0/24, 192.0.2.0/24)
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast y reservadas
  );
}

/** Expande una IPv6 a 8 grupos de 16 bits (null si no es IPv6). */
function parseIPv6(host: string): number[] | null {
  let h = host.replace(/^\[|\]$/g, "").toLowerCase();
  const zone = h.indexOf("%");
  if (zone >= 0) h = h.slice(0, zone);
  if (!h.includes(":")) return null;
  // IPv4 al final (::ffff:1.2.3.4)
  const lastColon = h.lastIndexOf(":");
  const tail = h.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    h = `${h.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 0) return null;
  const groups = [...left, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...right];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function isBlockedIPv6(g: number[]): boolean {
  const allZeroUntil = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (allZeroUntil(8)) return true; // ::
  if (allZeroUntil(7) && g[7] === 1) return true; // ::1
  // IPv4 mapeada (::ffff:a.b.c.d) o compatible (::a.b.c.d)
  if (allZeroUntil(5) && (g[5] === 0xffff || g[5] === 0)) {
    return isBlockedIPv4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b) return true; // NAT64 (puede apuntar a IPv4 internas)
  if ((g[0] & 0xfe00) === 0xfc00) return true; // ULA fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentación
  return false;
}

/** ¿Es una IP (v4 o v6) a la que no se debe llegar? null si no es una IP. */
export function isBlockedIp(ip: string): boolean | null {
  const v4 = parseIPv4(ip);
  if (v4) return isBlockedIPv4(v4);
  const v6 = parseIPv6(ip);
  if (v6) return isBlockedIPv6(v6);
  return null;
}

/** Valida la URL (sin red). Devuelve el motivo del rechazo o null si está bien. */
export function checkCalendarUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "invalid_url";
  }
  if (u.protocol !== "https:") return "not_https";
  if (u.port && u.port !== "443") return "port_not_allowed";
  if (u.username || u.password) return "credentials_in_url";
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const ipBlocked = isBlockedIp(host);
  if (ipBlocked === true) return "private_address";
  if (ipBlocked === false) return null; // IP pública literal
  // Formas numéricas raras que algunos clientes interpretan como IP (0x7f.1, 2130706433)
  if (/^[0-9.]+$/.test(host) || /^0x[0-9a-f]+/i.test(host)) return "private_address";
  if (!host.includes(".")) return "private_address";
  if (host === "localhost" || /\.(localhost|local|internal|home|lan|corp|intranet)$/.test(host)) return "private_address";
  return null;
}

export interface SafeFetchDeps {
  fetch: typeof fetch;
  /** IPs del host (A y AAAA). null = el runtime no permite resolver: se sigue con las reglas de host. */
  resolve?: (host: string) => Promise<string[] | null>;
  timeoutMs?: number;
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = max - total;
    if (value.byteLength >= room) {
      chunks.push(value.slice(0, room));
      total = max;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

async function hostIsPublic(url: string, deps: SafeFetchDeps): Promise<boolean> {
  if (checkCalendarUrl(url)) return false;
  if (!deps.resolve) return true;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isBlockedIp(host) !== null) return true; // IP literal ya validada
  let ips: string[] | null;
  try {
    ips = await deps.resolve(host);
  } catch {
    return false; // no resuelve: no hay nada que descargar
  }
  if (ips === null) return true;
  return ips.length > 0 && ips.every((ip) => isBlockedIp(ip) === false);
}

/** Descarga el .ics validando cada salto. null si no se pudo o no se permite. */
export async function safeFetchText(url: string, deps: SafeFetchDeps): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 10000);
  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await hostIsPublic(current, deps))) return null;
      const res = await deps.fetch(current, { signal: ctrl.signal, redirect: "manual" });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        await res.body?.cancel();
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return null;
      }
      return await readCapped(res, MAX_ICS_BYTES);
    }
    return null; // demasiadas redirecciones
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

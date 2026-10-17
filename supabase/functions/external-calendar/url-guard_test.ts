// Pruebas de la descarga segura de calendarios (url-guard.ts): sin red, el
// fetch y el DNS son dobles. Corre con `npm run test:functions`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCalendarUrl, isBlockedIp, safeFetchText, MAX_ICS_BYTES, type SafeFetchDeps } from "./url-guard.ts";

const ICS = "BEGIN:VCALENDAR\nEND:VCALENDAR\n";

test("IPs internas bloqueadas, públicas permitidas", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fe80::1", "fd00::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "64:ff9b::a9fe:a9fe", "[::1]",
  ]) assert.equal(isBlockedIp(ip), true, ip);
  for (const ip of ["8.8.8.8", "142.250.0.1", "172.32.0.1", "2607:f8b0:4004::1", "::ffff:8.8.8.8"]) {
    assert.equal(isBlockedIp(ip), false, ip);
  }
  assert.equal(isBlockedIp("calendar.google.com"), null);
});

test("URLs: solo https:443 a hosts públicos", () => {
  assert.equal(checkCalendarUrl("https://calendar.google.com/calendar/ical/x/basic.ics"), null);
  assert.equal(checkCalendarUrl("https://p01-caldav.icloud.com/published/2/abc"), null);
  assert.equal(checkCalendarUrl("http://calendar.google.com/x.ics"), "not_https");
  assert.equal(checkCalendarUrl("https://calendar.google.com:8443/x.ics"), "port_not_allowed");
  assert.equal(checkCalendarUrl("https://user:pass@calendar.google.com/x.ics"), "credentials_in_url");
  for (const bad of [
    "https://169.254.169.254/latest/meta-data/",
    "https://127.0.0.1/x.ics",
    "https://2130706433/x.ics", // 127.0.0.1 en decimal
    "https://0x7f.1/x.ics",
    "https://[::1]/x.ics",
    "https://[::ffff:10.0.0.1]/x.ics",
    "https://localhost/x.ics",
    "https://metadata/x.ics",
    "https://servicio.internal/x.ics",
    "https://impresora.local/x.ics",
  ]) assert.equal(checkCalendarUrl(bad), "private_address", bad);
});

function fakeFetch(routes: Record<string, () => Response>) {
  const pedidos: string[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    pedidos.push(url);
    assert.equal(init?.redirect, "manual", "las redirecciones se siguen a mano");
    const r = routes[url];
    return r ? r() : new Response("no", { status: 404 });
  }) as typeof fetch;
  return { f, pedidos };
}

const deps = (f: typeof fetch, dns: Record<string, string[]> = {}): SafeFetchDeps => ({
  fetch: f,
  resolve: async (host) => {
    if (host in dns) return dns[host];
    return ["142.250.0.1"];
  },
});

test("descarga un calendario público", async () => {
  const { f } = fakeFetch({ "https://calendar.google.com/a.ics": () => new Response(ICS) });
  assert.equal(await safeFetchText("https://calendar.google.com/a.ics", deps(f)), ICS);
});

test("una redirección hacia metadatos de la nube se corta antes de pedirla", async () => {
  const { f, pedidos } = fakeFetch({
    "https://evil.example.com/a.ics": () =>
      new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data/" } }),
  });
  assert.equal(await safeFetchText("https://evil.example.com/a.ics", deps(f)), null);
  assert.deepEqual(pedidos, ["https://evil.example.com/a.ics"]);
});

test("una redirección a http se corta", async () => {
  const { f, pedidos } = fakeFetch({
    "https://evil.example.com/a.ics": () =>
      new Response(null, { status: 301, headers: { location: "http://calendar.google.com/a.ics" } }),
  });
  assert.equal(await safeFetchText("https://evil.example.com/a.ics", deps(f)), null);
  assert.equal(pedidos.length, 1);
});

test("redirecciones legítimas (p. ej. iCloud cambia de servidor) se siguen, hasta 3", async () => {
  const { f } = fakeFetch({
    "https://p01-caldav.icloud.com/x": () => new Response(null, { status: 301, headers: { location: "https://p52-caldav.icloud.com/x" } }),
    "https://p52-caldav.icloud.com/x": () => new Response(ICS),
  });
  assert.equal(await safeFetchText("https://p01-caldav.icloud.com/x", deps(f)), ICS);

  const loop = fakeFetch({
    "https://a.example.com/x": () => new Response(null, { status: 302, headers: { location: "https://a.example.com/x" } }),
  });
  assert.equal(await safeFetchText("https://a.example.com/x", deps(loop.f)), null);
  assert.equal(loop.pedidos.length, 4);
});

test("un dominio que resuelve a una IP interna no se pide (DNS)", async () => {
  const { f, pedidos } = fakeFetch({ "https://rebind.example.com/a.ics": () => new Response(ICS) });
  const d = deps(f, { "rebind.example.com": ["142.250.0.1", "10.0.0.5"] });
  assert.equal(await safeFetchText("https://rebind.example.com/a.ics", d), null);
  assert.deepEqual(pedidos, []);
});

test("si el runtime no permite resolver DNS, rigen las reglas del host", async () => {
  const { f } = fakeFetch({ "https://calendar.google.com/a.ics": () => new Response(ICS) });
  const d: SafeFetchDeps = { fetch: f, resolve: async () => null };
  assert.equal(await safeFetchText("https://calendar.google.com/a.ics", d), ICS);
  assert.equal(await safeFetchText("https://127.0.0.1/a.ics", d), null);
});

test("respuestas enormes se cortan en el máximo", async () => {
  const big = "X".repeat(MAX_ICS_BYTES + 1000);
  const { f } = fakeFetch({ "https://calendar.google.com/big.ics": () => new Response(big) });
  const text = await safeFetchText("https://calendar.google.com/big.ics", deps(f));
  assert.equal(text?.length, MAX_ICS_BYTES);
});

test("errores de red o de estado: null", async () => {
  const boom = (async () => { throw new Error("ECONNRESET"); }) as typeof fetch;
  assert.equal(await safeFetchText("https://calendar.google.com/a.ics", deps(boom)), null);
  const { f } = fakeFetch({});
  assert.equal(await safeFetchText("https://calendar.google.com/404.ics", deps(f)), null);
});

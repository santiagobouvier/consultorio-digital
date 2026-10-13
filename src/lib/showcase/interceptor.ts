// Capa aislada del modo capturas. Se instala ANTES de que arranque la app
// (boot.ts) y SOLO si la pestaña tiene la marca del modo. Mientras está
// activa:
//
//  - Ninguna lectura ni escritura llega a la base: /rest/v1, /functions/v1 y
//    /storage/v1 se responden desde datos ficticios en memoria (postgrest.ts
//    + fixtures.ts). Las escrituras cambian solo esa copia en memoria.
//  - Solo salen a la red: renovar el token de la sesión, leer el usuario,
//    cerrar sesión y la consulta de autorización can_use_showcase_mode
//    (de solo lectura). Cualquier otro cambio de la cuenta se bloquea.
//  - Se bloquean llamadas a otros dominios, tiempo real (WebSocket),
//    sendBeacon, registro/baja de push, ventanas y enlaces externos
//    (wa.me, mailto:, tel:, Mercado Pago…).
//  - localStorage/sessionStorage escriben en una capa en memoria: lo real
//    no se toca (salvo el token de sesión de Supabase y la propia marca).
//
// Al salir del modo se recarga la página sin la marca: nada de esto queda
// instalado y reaparecen únicamente los datos reales.

import { handleRest, type Row, type Store } from "./postgrest.ts";
import { buildShowcaseStore, showcaseRpc, type FixtureOptions } from "./fixtures.ts";
import { AUTHZ_RPC, SHOWCASE_SESSION_KEY, type ShowcaseSession } from "./session.ts";

export { AUTHZ_RPC };

export type ShowcaseRoute =
  | { kind: "passthrough"; reason: "auth" | "authz" | "same-origin" | "local" }
  | { kind: "rest"; table: string }
  | { kind: "rpc"; name: string }
  | { kind: "function"; name: string }
  | { kind: "storage"; path: string }
  | { kind: "blocked"; reason: "auth-change" | "external" | "write-same-origin" | "unknown-supabase" };

export interface BlockedEvent {
  kind: string;
  method: string;
  /** Solo origen + ruta, sin query (puede tener datos). */
  target: string;
  at: string;
}

/** Decide qué hacer con un pedido. Puro: se prueba sin navegador. */
export function classifyRequest(url: URL, method: string, supabaseOrigin: string, appOrigin: string): ShowcaseRoute {
  if (url.protocol === "data:" || url.protocol === "blob:") return { kind: "passthrough", reason: "local" };
  const m = method.toUpperCase();
  if (url.origin === supabaseOrigin) {
    const p = url.pathname;
    if (p.startsWith("/auth/v1/")) {
      if (p === "/auth/v1/user" && m === "GET") return { kind: "passthrough", reason: "auth" };
      if (p === "/auth/v1/token" && m === "POST" && url.searchParams.get("grant_type") === "refresh_token") {
        return { kind: "passthrough", reason: "auth" };
      }
      if (p === "/auth/v1/logout" && m === "POST") return { kind: "passthrough", reason: "auth" };
      return { kind: "blocked", reason: "auth-change" };
    }
    if (p.startsWith("/rest/v1/rpc/")) {
      const name = decodeURIComponent(p.slice("/rest/v1/rpc/".length));
      if (name === AUTHZ_RPC && m === "POST") return { kind: "passthrough", reason: "authz" };
      return { kind: "rpc", name };
    }
    if (p.startsWith("/rest/v1/")) return { kind: "rest", table: decodeURIComponent(p.slice("/rest/v1/".length)) };
    if (p.startsWith("/functions/v1/")) return { kind: "function", name: p.slice("/functions/v1/".length).split("/")[0] };
    if (p.startsWith("/storage/v1/")) return { kind: "storage", path: p.slice("/storage/v1/".length) };
    return { kind: "blocked", reason: "unknown-supabase" };
  }
  if (url.origin === appOrigin) {
    return m === "GET" || m === "HEAD" ? { kind: "passthrough", reason: "same-origin" } : { kind: "blocked", reason: "write-same-origin" };
  }
  return { kind: "blocked", reason: "external" };
}

const SIMULATED = { ok: true, success: true, showcase: true, message: "Modo capturas: acción simulada, no se envió ni se guardó nada." };

/** Respuestas de las edge functions (ninguna se ejecuta). */
export function functionResponse(name: string, body: unknown): { status: number; body: unknown } {
  const action = body && typeof body === "object" ? (body as Row).action : undefined;
  switch (name) {
    case "external-calendar":
      if (action === "list") return { status: 200, body: { calendars: [] } };
      if (action === "busy") return { status: 200, body: { busy: [], connected: 0 } };
      return { status: 400, body: { error: "En modo capturas no se conectan calendarios externos." } };
    case "google-calendar-sync":
      return { status: 200, body: { connected: false, email: null } };
    case "get-mp-config":
      return { status: 200, body: { app_id: "modo-capturas" } };
    default:
      return { status: 200, body: SIMULATED };
  }
}

/** Storage: nada se sube ni se descarga de verdad. */
export function storageResponse(path: string, method: string): { status: number; body: unknown; text?: string } {
  if (path.startsWith("object/sign/")) return { status: 200, body: { signedURL: "/object/sign/modo-capturas/documento-de-ejemplo" } };
  if (path.startsWith("object/list/")) return { status: 200, body: [] };
  if (method === "GET") return { status: 200, body: null, text: "Documento de ejemplo (modo capturas)." };
  return { status: 200, body: { Key: "modo-capturas/no-guardado", Id: "modo-capturas" } };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const noBody = status === 204 || body === null || body === undefined;
  return new Response(noBody && status === 204 ? null : JSON.stringify(body ?? null), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  let raw: unknown = init?.body;
  if (raw === undefined && input instanceof Request && input.method !== "GET" && input.method !== "HEAD") {
    raw = await input.clone().text();
  }
  if (typeof raw !== "string") return raw === undefined ? undefined : null; // FormData/Blob: archivos, no se leen
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export interface ShowcaseFetchOptions {
  supabaseOrigin: string;
  appOrigin: string;
  realFetch: typeof fetch;
  store: Store;
  fixture: FixtureOptions;
  record: (e: BlockedEvent) => void;
}

export function createShowcaseFetch(o: ShowcaseFetchOptions): typeof fetch {
  return async function showcaseFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, o.appOrigin);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const route = classifyRequest(url, method, o.supabaseOrigin, o.appOrigin);
    if (route.kind === "passthrough") return o.realFetch(input as RequestInfo, init);

    const target = `${url.origin}${url.pathname}`;
    const writes = method !== "GET" && method !== "HEAD";
    if (route.kind === "blocked" || writes || route.kind === "function" || route.kind === "storage") {
      o.record({ kind: route.kind === "blocked" ? route.reason : route.kind, method, target, at: new Date().toISOString() });
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const body = await readBody(input, init);

    switch (route.kind) {
      case "rest": {
        const r = handleRest(o.store, { method, table: route.table, params: url.searchParams, headers, body });
        return jsonResponse(r.status, r.body, r.headers);
      }
      case "rpc":
        return jsonResponse(200, showcaseRpc(o.store, route.name, (body ?? {}) as Row, o.fixture));
      case "function": {
        const r = functionResponse(route.name, body);
        return jsonResponse(r.status, r.body);
      }
      case "storage": {
        const r = storageResponse(route.path, method);
        if (r.text !== undefined) return new Response(r.text, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
        return jsonResponse(r.status, r.body);
      }
      default:
        return jsonResponse(403, { error: "showcase_blocked", message: "Modo capturas: este pedido no sale del navegador." });
    }
  };
}

// ── almacenamiento local en capa de memoria ──

export interface StorageOverlay {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(i: number): string | null;
  readonly length: number;
}

/**
 * Lecturas: primero la capa, si no lo real. Escrituras: solo la capa (salvo
 * las claves que deben seguir siendo reales: token de sesión y la marca).
 */
export function createStorageOverlay(real: StorageOverlay, isRealKey: (k: string) => boolean): StorageOverlay {
  const layer = new Map<string, string | null>(); // null = borrado en la capa
  const keys = () => {
    const set = new Set<string>();
    for (let i = 0; i < real.length; i++) {
      const k = real.key(i);
      if (k !== null && !(layer.has(k) && layer.get(k) === null)) set.add(k);
    }
    for (const [k, v] of layer) if (v !== null) set.add(k);
    return [...set];
  };
  return {
    getItem: (k) => (!isRealKey(k) && layer.has(k) ? layer.get(k)! : real.getItem(k)),
    setItem: (k, v) => (isRealKey(k) ? real.setItem(k, v) : void layer.set(k, String(v))),
    removeItem: (k) => (isRealKey(k) ? real.removeItem(k) : void layer.set(k, null)),
    clear: () => {
      for (const k of keys()) if (!isRealKey(k)) layer.set(k, null);
    },
    key: (i) => keys()[i] ?? null,
    get length() {
      return keys().length;
    },
  };
}

export const isRealStorageKey = (k: string) => k === SHOWCASE_SESSION_KEY || /^sb-.+-auth-token(-code-verifier)?$/.test(k);

// ── instalación en el navegador ──

export interface ShowcaseRuntime {
  session: ShowcaseSession;
  store: Store;
  blocked: BlockedEvent[];
}

type Win = Window & typeof globalThis;

export function installShowcase(win: Win, session: ShowcaseSession, supabaseUrl: string): ShowcaseRuntime {
  const appOrigin = win.location.origin;
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const fixture: FixtureOptions = { businessId: session.businessId, userId: session.userId };
  const runtime: ShowcaseRuntime = { session, store: buildShowcaseStore(fixture), blocked: [] };
  const record = (e: BlockedEvent) => {
    runtime.blocked.push(e);
    win.dispatchEvent(new CustomEvent("cd-showcase:blocked", { detail: e }));
  };

  // 1) Red
  const realFetch = win.fetch.bind(win);
  win.fetch = createShowcaseFetch({ supabaseOrigin, appOrigin, realFetch, store: runtime.store, fixture, record });

  // 2) Tiempo real y otros canales salientes
  const RealWS = win.WebSocket;
  class BlockedSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = 0;
    url: string;
    protocol = "";
    binaryType: BinaryType = "blob";
    bufferedAmount = 0;
    extensions = "";
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: Event) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    constructor(url: string | URL) {
      super();
      this.url = String(url);
      record({ kind: "realtime", method: "WS", target: this.url.split("?")[0], at: new Date().toISOString() });
    }
    send() {}
    close() {
      this.readyState = 3;
    }
  }
  const PatchedWS = function (this: unknown, url: string | URL, protocols?: string | string[]) {
    const u = new URL(String(url), appOrigin);
    if (u.host === win.location.host) return new RealWS(url, protocols);
    return new BlockedSocket(url);
  } as unknown as typeof WebSocket;
  Object.assign(PatchedWS, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  win.WebSocket = PatchedWS;
  if (win.navigator.sendBeacon) {
    win.navigator.sendBeacon = (url: string | URL) => {
      record({ kind: "beacon", method: "POST", target: String(url).split("?")[0], at: new Date().toISOString() });
      return false;
    };
  }
  if (win.EventSource) {
    win.EventSource = class {
      constructor(url: string | URL) {
        record({ kind: "eventsource", method: "GET", target: String(url).split("?")[0], at: new Date().toISOString() });
      }
      close() {}
      addEventListener() {}
      removeEventListener() {}
    } as unknown as typeof EventSource;
  }

  // 3) Almacenamiento local
  const overlays = new Map<Storage, StorageOverlay>();
  const proto = win.Storage.prototype;
  const orig = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
    key: proto.key,
    length: Object.getOwnPropertyDescriptor(proto, "length")?.get,
  };
  const realView = (s: Storage): StorageOverlay => ({
    getItem: (k) => orig.getItem.call(s, k),
    setItem: (k, v) => orig.setItem.call(s, k, v),
    removeItem: (k) => orig.removeItem.call(s, k),
    clear: () => orig.clear.call(s),
    key: (i) => orig.key.call(s, i),
    get length() {
      return (orig.length?.call(s) as number) ?? 0;
    },
  });
  const overlayFor = (s: Storage) => {
    let o = overlays.get(s);
    if (!o) {
      o = createStorageOverlay(realView(s), isRealStorageKey);
      overlays.set(s, o);
    }
    return o;
  };
  proto.getItem = function (k: string) {
    return overlayFor(this).getItem(k);
  };
  proto.setItem = function (k: string, v: string) {
    overlayFor(this).setItem(k, v);
  };
  proto.removeItem = function (k: string) {
    overlayFor(this).removeItem(k);
  };
  proto.clear = function () {
    overlayFor(this).clear();
  };
  proto.key = function (i: number) {
    return overlayFor(this).key(i);
  };
  Object.defineProperty(proto, "length", {
    configurable: true,
    get(this: Storage) {
      return overlayFor(this).length;
    },
  });

  // Avisos de "primera vez" ya vistos (solo en la capa): capturas limpias
  try {
    const lo = overlayFor(win.localStorage);
    lo.setItem(`activation_celebrated_${session.businessId}`, new Date().toISOString());
    lo.setItem("agenda_legend_seen_v1", "1");
  } catch {
    /* sin localStorage */
  }

  // 4) Push y permisos: ni alta ni baja de la suscripción real del dispositivo
  const PM = (win as unknown as { PushManager?: { prototype: PushManager } }).PushManager;
  if (PM) {
    PM.prototype.getSubscription = async () => null;
    PM.prototype.subscribe = async () => {
      record({ kind: "push-subscribe", method: "-", target: "PushManager.subscribe", at: new Date().toISOString() });
      throw new DOMException("Modo capturas: no se registran avisos push.", "NotAllowedError");
    };
  }
  const N = (win as unknown as { Notification?: typeof Notification }).Notification;
  if (N) N.requestPermission = (async () => N.permission) as typeof Notification.requestPermission;

  // 5) Ventanas y enlaces externos (WhatsApp, correo, teléfono, pagos…)
  const realOpen = win.open.bind(win);
  const fakeWindow = () => {
    const loc = {
      set href(v: string) {
        record({ kind: "navigation", method: "GET", target: String(v).split("?")[0], at: new Date().toISOString() });
      },
      get href() {
        return "about:blank";
      },
      assign(v: string) {
        this.href = v;
      },
      replace(v: string) {
        this.href = v;
      },
    };
    return { location: loc, close() {}, focus() {}, closed: false, document: { write() {}, close() {}, title: "" } } as unknown as Window;
  };
  win.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url) {
      const u = new URL(String(url), appOrigin);
      if (u.origin === appOrigin && (u.protocol === "http:" || u.protocol === "https:")) return realOpen(url, target, features);
      record({ kind: "external-window", method: "GET", target: `${u.protocol}//${u.host}${u.pathname}`, at: new Date().toISOString() });
    }
    return fakeWindow();
  }) as typeof win.open;
  win.document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let u: URL;
      try {
        u = new URL(a.href, appOrigin);
      } catch {
        return;
      }
      const external = u.protocol === "http:" || u.protocol === "https:" ? u.origin !== appOrigin : u.protocol !== "javascript:";
      if (!external) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      record({ kind: "external-link", method: "GET", target: `${u.protocol}//${u.host}${u.pathname}`, at: new Date().toISOString() });
    },
    true,
  );

  (win as unknown as { __cdShowcase: ShowcaseRuntime }).__cdShowcase = runtime;
  return runtime;
}

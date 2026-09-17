import { supabase } from "@/integrations/supabase/client";

const RELOAD_COUNTER_KEY = "__app_reload_counter";
const RELOAD_WINDOW_START_KEY = "__app_reload_window_start";
const CHUNK_RECOVERY_STATE_KEY = "__app_chunk_recovery_state";
// Marca que la PRÓXIMA recarga la disparó el propio sistema (no el usuario).
// El detector de bucles solo cuenta recargas con esta marca: un usuario
// apretando F5 varias veces seguidas NUNCA debe perder la sesión por eso.
const AUTO_RELOAD_FLAG_KEY = "__app_auto_reload";
// Red de seguridad relajada: solo se dispara si hay 5+ reloads en 30s.
// Los fixes de auth-sync + AuthContext eliminan el bucle real; este guard
// queda como protección residual para casos edge.
const RELOAD_WINDOW_MS = 30_000;
const RELOAD_THRESHOLD = 5;
const CHUNK_RECOVERY_WINDOW_MS = 120_000;

const CHUNK_LOAD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  // Stale prod bundle: la lazy resolvió a undefined y React.lazy hace `module.default`.
  /Cannot read properties of undefined \(reading 'default'\)/i,
  /undefined is not an object \(evaluating '.*\.default'\)/i,
];

let cacheClearPromise: Promise<void> | null = null;
let hardResetPromise: Promise<void> | null = null;

// ── Frenos a prueba de TODO contra bucles de recarga ──
// Los guards de sessionStorage de más abajo pueden fallar (storage roto,
// pestañas que se limpian los caches entre sí). Estos dos no dependen de
// ningún storage: (1) una sola recuperación por carga de página, en memoria;
// (2) un contador que viaja en la propia URL y sobrevive a cualquier recarga.
// A la tercera falla seguida, la recuperación se rinde y la app muestra el
// botón "Recargar ahora" en lugar de recargar sola.
let recoveryTriggeredThisLoad = false;
const RECOVERY_MARKER_PARAM = "__cdr";

const getRecoveryMarkerCount = (): number => {
  try {
    const raw = new URLSearchParams(window.location.search).get(RECOVERY_MARKER_PARAM);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
};

/** Cuando la app arrancó bien, borra el contador de la URL (sin recargar). */
export const stripRecoveryMarkerWhenStable = (delayMs = 10_000) => {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(RECOVERY_MARKER_PARAM)) return;
      url.searchParams.delete(RECOVERY_MARKER_PARAM);
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : "") + url.hash);
    } catch {
      /* nada: el marcador queda en la URL, sin efecto */
    }
  }, delayMs);
};

const getErrorText = (error: unknown): string => {
  if (!error) return "";
  if (typeof error === "string") return error;

  if (error instanceof Error) {
    return `${error.name} ${error.message} ${error.stack ?? ""}`;
  }

  if (typeof error === "object") {
    const maybeError = error as { message?: unknown; stack?: unknown; reason?: unknown; payload?: unknown };
    return [maybeError.message, maybeError.stack, maybeError.reason, maybeError.payload]
      .map((value) => (typeof value === "string" ? value : getErrorText(value)))
      .filter(Boolean)
      .join(" ");
  }

  return "";
};

export const isChunkLoadFailure = (error: unknown): boolean => {
  const text = getErrorText(error);
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(text));
};

const getServiceWorkerRegistrations = async (): Promise<ServiceWorkerRegistration[]> => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return [];
  }

  try {
    return Array.from(await navigator.serviceWorker.getRegistrations());
  } catch (error) {
    console.warn("No pudimos leer los service workers registrados", error);
    return [];
  }
};

const notifyServiceWorkersToClearCaches = async () => {
  const registrations = await getServiceWorkerRegistrations();

  await Promise.all(
    registrations.flatMap((registration) =>
      [registration.active, registration.waiting, registration.installing]
        .filter((worker): worker is ServiceWorker => Boolean(worker))
        .map(
          (worker) =>
            new Promise<void>((resolve) => {
              try {
                const channel = new MessageChannel();
                let settled = false;

                const finish = () => {
                  if (settled) return;
                  settled = true;
                  resolve();
                };

                channel.port1.onmessage = finish;
                worker.postMessage({ type: "CLEAR_APP_CACHES" }, [channel.port2]);
                window.setTimeout(finish, 150);
              } catch {
                resolve();
              }
            })
        )
    )
  );
};

interface ClearServiceWorkerCachesOptions {
  unregister?: boolean;
}

export const clearServiceWorkerCaches = async (
  options: ClearServiceWorkerCachesOptions = {}
) => {
  if (typeof window === "undefined") return;

  if (!cacheClearPromise) {
    cacheClearPromise = (async () => {
      await notifyServiceWorkersToClearCaches();

      if ("caches" in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        } catch (error) {
          console.warn("No pudimos limpiar los caches del navegador", error);
        }
      }

      if (options.unregister) {
        const registrations = await getServiceWorkerRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
    })().finally(() => {
      cacheClearPromise = null;
    });
  }

  await cacheClearPromise;
};

interface HardResetBrowserSessionOptions {
  redirectTo?: string;
  signOut?: boolean;
}

export const hardResetBrowserSession = async (
  options: HardResetBrowserSessionOptions = {}
) => {
  const { redirectTo = "/", signOut = true } = options;

  if (typeof window === "undefined") return;

  if (hardResetPromise) {
    await hardResetPromise;
    return;
  }

  hardResetPromise = (async () => {
    try {
      if (signOut) {
        try {
          await supabase.auth.signOut();
        } catch (error) {
          console.warn("No pudimos cerrar la sesión antes de limpiar el navegador", error);
        }
      }

      try {
        localStorage.clear();
      } catch (error) {
        console.warn("No pudimos limpiar localStorage", error);
      }

      try {
        sessionStorage.clear();
      } catch (error) {
        console.warn("No pudimos limpiar sessionStorage", error);
      }

      await clearServiceWorkerCaches({ unregister: true });
    } finally {
      hardResetPromise = null;
      window.location.replace(redirectTo);
    }
  })();

  await hardResetPromise;
};

interface RecoverFromChunkLoadFailureOptions {
  unregisterServiceWorkers?: boolean;
}

export const recoverFromChunkLoadFailure = async (
  options: RecoverFromChunkLoadFailureOptions = {}
) => {
  if (typeof window === "undefined") return false;

  // Frenos duros (no dependen de storage): una recuperación por carga y
  // máximo 2 recargas automáticas seguidas por pestaña.
  if (recoveryTriggeredThisLoad) return false;
  const markerCount = getRecoveryMarkerCount();
  if (markerCount >= 2) return false;

  const now = Date.now();
  const path = `${window.location.pathname}${window.location.search}`;

  try {
    const previous = JSON.parse(
      sessionStorage.getItem(CHUNK_RECOVERY_STATE_KEY) ?? "null"
    ) as { path?: string; at?: number } | null;

    if (
      previous?.path === path &&
      typeof previous.at === "number" &&
      now - previous.at < CHUNK_RECOVERY_WINDOW_MS
    ) {
      return false;
    }

    sessionStorage.setItem(CHUNK_RECOVERY_STATE_KEY, JSON.stringify({ path, at: now }));
  } catch {
    // Si sessionStorage falla, seguimos con la recuperación; peor caso, una recarga.
  }

  await clearServiceWorkerCaches({ unregister: options.unregisterServiceWorkers ?? true });
  try {
    sessionStorage.setItem(AUTO_RELOAD_FLAG_KEY, "1");
  } catch {
    // sin marca, el detector simplemente no cuenta esta recarga
  }
  recoveryTriggeredThisLoad = true;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(RECOVERY_MARKER_PARAM, String(markerCount + 1));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
  return true;
};

export const detectReloadLoopAndRecover = async () => {
  if (typeof window === "undefined") return false;

  try {
    // Solo cuentan las recargas AUTOMÁTICAS (marcadas por el sistema).
    // Una carga normal o un F5 del usuario resetea el contador y sale:
    // refrescar a mano jamás puede terminar en un cierre de sesión.
    const wasAutoReload = sessionStorage.getItem(AUTO_RELOAD_FLAG_KEY) === "1";
    sessionStorage.removeItem(AUTO_RELOAD_FLAG_KEY);
    if (!wasAutoReload) {
      sessionStorage.removeItem(RELOAD_COUNTER_KEY);
      sessionStorage.removeItem(RELOAD_WINDOW_START_KEY);
      return false;
    }

    const now = Date.now();
    const windowStart = Number(sessionStorage.getItem(RELOAD_WINDOW_START_KEY) ?? "0");
    const currentCount = Number(sessionStorage.getItem(RELOAD_COUNTER_KEY) ?? "0");

    const isSameWindow = windowStart > 0 && now - windowStart <= RELOAD_WINDOW_MS;
    const nextWindowStart = isSameWindow ? windowStart : now;
    const nextCount = isSameWindow ? currentCount + 1 : 1;

    sessionStorage.setItem(RELOAD_WINDOW_START_KEY, String(nextWindowStart));
    sessionStorage.setItem(RELOAD_COUNTER_KEY, String(nextCount));

    if (nextCount > RELOAD_THRESHOLD) {
      await hardResetBrowserSession({ redirectTo: "/" });
      return true;
    }
  } catch (error) {
    console.warn("No pudimos ejecutar el detector de loops", error);
  }

  return false;
};
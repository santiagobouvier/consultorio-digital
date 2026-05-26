import { supabase } from "@/integrations/supabase/client";

const RELOAD_COUNTER_KEY = "__app_reload_counter";
const RELOAD_WINDOW_START_KEY = "__app_reload_window_start";
// Red de seguridad relajada: solo se dispara si hay 5+ reloads en 30s.
// Los fixes de auth-sync + AuthContext eliminan el bucle real; este guard
// queda como protección residual para casos edge.
const RELOAD_WINDOW_MS = 30_000;
const RELOAD_THRESHOLD = 5;

let cacheClearPromise: Promise<void> | null = null;
let hardResetPromise: Promise<void> | null = null;

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

export const detectReloadLoopAndRecover = async () => {
  if (typeof window === "undefined") return false;

  try {
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
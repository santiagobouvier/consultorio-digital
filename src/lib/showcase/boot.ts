// PRIMER import de main.tsx. Sin la marca del modo capturas en esta pestaña
// no hace nada más que leer sessionStorage: no toca fetch, storage ni nada
// global, y la capa (interceptor + datos ficticios) ni se descarga.
// Con la marca, descarga la capa y main.tsx espera showcaseReady() antes de
// mostrar la app: ninguna pantalla consulta datos antes de que esté puesta.
import { clearShowcaseSession, readShowcaseSession } from "./session.ts";

let ready: Promise<void> = Promise.resolve();

function boot() {
  if (typeof window === "undefined") return;
  let session = null;
  try {
    session = readShowcaseSession(window.sessionStorage);
  } catch {
    return;
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!session || !supabaseUrl) return;
  const s = session;
  ready = import("./interceptor.ts")
    .then(({ installShowcase }) => {
      installShowcase(window, s, supabaseUrl);
    })
    .catch(() => {
      // Sin la capa no se muestra nada: se sale del modo y se recarga normal.
      clearShowcaseSession(window.sessionStorage);
      window.location.reload();
      return new Promise<void>(() => {});
    });
}

boot();

export const showcaseReady = () => ready;

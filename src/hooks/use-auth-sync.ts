import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  createAuthSyncChannel,
  detectAuthScope,
  type AuthSyncChannel,
  type AuthSyncScope,
} from "@/lib/auth-sync";

/**
 * Hook único (instanciar UNA sola vez, en App) que coordina las pestañas:
 *
 * - Emite SIGNED_IN/SIGNED_OUT en el canal del scope donde ocurrió el evento.
 * - Escucha SIGNED_OUT de otras pestañas del MISMO scope: si esta pestaña está
 *   en una ruta protegida de ese scope, navega con react-router (sin reload).
 * - SIGNED_IN entrante: no hace nada acá; supabase-js ya propaga la sesión
 *   por storage event y AuthContext reacciona internamente.
 * - TOKEN_REFRESHED: no se broadcast, cada pestaña refresca su propio token.
 */
export const useAuthSync = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;

  // Mantenemos ambos canales abiertos siempre; el scope solo determina por
  // cuál emitimos y a cuál reaccionamos en función de la ruta actual.
  const channelsRef = useRef<Record<AuthSyncScope, AuthSyncChannel> | null>(null);

  if (channelsRef.current === null) {
    channelsRef.current = {
      pro: createAuthSyncChannel("pro"),
      patient: createAuthSyncChannel("patient"),
    };
  }

  useEffect(() => {
    // En StrictMode/HMR el cleanup del segundo effect puede haber nulleado
    // la ref sin que el render body vuelva a correr. Re-inicializamos si hace falta.
    if (channelsRef.current === null) {
      channelsRef.current = {
        pro: createAuthSyncChannel("pro"),
        patient: createAuthSyncChannel("patient"),
      };
    }
    const channels = channelsRef.current;

    // Listener de eventos locales de supabase para emitir broadcast.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const scope = detectAuthScope(pathRef.current);
      if (!scope) return;

      if (event === "SIGNED_IN" && session?.user?.id) {
        channels[scope].post({ type: "SIGNED_IN", userId: session.user.id });
      } else if (event === "SIGNED_OUT") {
        channels[scope].post({ type: "SIGNED_OUT" });
      }
      // TOKEN_REFRESHED / USER_UPDATED: no se propaga.
    });

    // Listener de broadcasts entrantes para cada scope.
    const handleIncoming = (scope: AuthSyncScope) => (msg: { type: string }) => {
      if (msg.type !== "SIGNED_OUT") return;
      // Solo reaccionamos si esta pestaña está en el scope correspondiente.
      const currentScope = detectAuthScope(pathRef.current);
      if (currentScope !== scope) return;

      if (scope === "pro") {
        navigate("/auth", { replace: true });
      } else {
        // Portal de paciente: navegar a la home del portal según la URL actual.
        // /portal/:slug → re-entrar al mismo slug para mostrar BrandedLogin.
        const path = pathRef.current;
        if (path.startsWith("/portal/")) {
          const slug = path.split("/")[2] ?? "";
          navigate(`/portal/${slug}`, { replace: true });
        } else {
          navigate("/portal-paciente", { replace: true });
        }
      }
    };

    const unsubPro = channels.pro.onMessage(handleIncoming("pro"));
    const unsubPatient = channels.patient.onMessage(handleIncoming("patient"));

    return () => {
      subscription.unsubscribe();
      unsubPro();
      unsubPatient();
    };
  }, [navigate]);

  // Cerrar canales al desmontar la app (en práctica nunca, pero por higiene).
  useEffect(() => {
    return () => {
      channelsRef.current?.pro.close();
      channelsRef.current?.patient.close();
      channelsRef.current = null;
    };
  }, []);
};
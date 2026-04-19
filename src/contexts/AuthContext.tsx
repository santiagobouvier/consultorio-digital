import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  isSuperAdmin: boolean;
  isReady: boolean;
  refreshSuperAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SUPER_ADMIN_EMAIL = "santib1997@gmail.com";

/**
 * Singleton de autenticación. Carga la sesión UNA sola vez con getSession()
 * (lectura desde localStorage, instantánea, sin HTTP) y escucha cambios.
 *
 * Esto reemplaza el patrón anti-performante de tener decenas de componentes
 * llamando supabase.auth.getUser() en paralelo (cada uno hace fetch HTTP de
 * ~2s en mobile, generando loops y bloqueando la UI).
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const lastCheckedUserId = useRef<string | null>(null);

  const checkSuperAdmin = async (currentUser: User | null) => {
    if (!currentUser) {
      setIsSuperAdmin(false);
      lastCheckedUserId.current = null;
      return;
    }

    // Email shortcut: el super admin principal queda detectado al instante,
    // sin necesidad de RPC. Evita una llamada de red en mobile.
    const normalizedEmail = currentUser.email?.trim().toLowerCase();
    if (normalizedEmail === SUPER_ADMIN_EMAIL) {
      setIsSuperAdmin(true);
      lastCheckedUserId.current = currentUser.id;
      return;
    }

    // Para otros usuarios consultamos el rol una sola vez por sesión.
    if (lastCheckedUserId.current === currentUser.id) return;
    lastCheckedUserId.current = currentUser.id;

    try {
      const { data } = await supabase.rpc("is_super_admin", { _user_id: currentUser.id });
      setIsSuperAdmin(Boolean(data));
    } catch {
      setIsSuperAdmin(false);
    }
  };

  const refreshSuperAdmin = async () => {
    lastCheckedUserId.current = null;
    await checkSuperAdmin(user);
  };

  useEffect(() => {
    let cancelled = false;

    // 1) Listener de cambios de sesión PRIMERO (capta SIGNED_IN/SIGNED_OUT/TOKEN_REFRESHED).
    //    Mantenemos el callback síncrono — sin await — para evitar deadlocks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      // Fire and forget — no await dentro del callback.
      void checkSuperAdmin(nextUser);
    });

    // 2) Restaurar la sesión existente desde localStorage (instantáneo, sin HTTP).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      void checkSuperAdmin(nextUser).finally(() => {
        if (!cancelled) setIsReady(true);
      });
      // Si no hay usuario, igual marcamos ready inmediatamente.
      if (!nextUser) setIsReady(true);
    }).catch(() => {
      if (!cancelled) setIsReady(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isSuperAdmin, isReady, refreshSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
};

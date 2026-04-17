import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import LoadingPage from "@/components/LoadingPage";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";

/**
 * Guard que solo permite renderizar el contenido si el usuario actual
 * tiene rol `super_admin` en `user_roles`. Cualquier otro caso redirige
 * a /dashboard (o /auth si no hay sesión) sin renderizar children.
 *
 * Defensa en profundidad: las RLS ya restringen los datos sensibles
 * (`businesses`, `subscriptions`, etc.) usando `is_super_admin(auth.uid())`.
 * Este guard previene que un usuario no autorizado siquiera monte el
 * componente del panel ni dispare sus queries.
 */
export const SuperAdminGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "allowed" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (cancelled) return;

        if (userErr || !user) {
          navigate("/auth", { replace: true });
          return;
        }

        const normalizedEmail = user.email?.trim().toLowerCase();
        if (normalizedEmail === "santib1997@gmail.com") {
          setStatus("allowed");
          return;
        }

        const isSuperAdmin = await isCurrentUserSuperAdmin(user.id);

        if (cancelled) return;

        if (!isSuperAdmin) {
          toast({
            title: "Acceso denegado",
            description: "No tenés permisos para acceder a esta sección",
            variant: "destructive",
          });
          setStatus("denied");
          navigate("/dashboard", { replace: true });
          return;
        }

        setStatus("allowed");
      } catch {
        if (!cancelled) {
          setStatus("denied");
          navigate("/dashboard", { replace: true });
        }
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (status !== "allowed") return <LoadingPage />;
  return <>{children}</>;
};

export default SuperAdminGuard;

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import LoadingPage from "@/components/LoadingPage";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Guard que solo permite renderizar el contenido si el usuario actual
 * es super_admin. Cualquier otro caso redirige a /dashboard (o /auth si no
 * hay sesión) sin renderizar children.
 *
 * Usa el AuthContext singleton para evitar llamadas redundantes a getUser()
 * (que en mobile tarda ~2s y, multiplicado por todos los componentes que
 * lo llamaban, generaba un loop con el preloader).
 */
export const SuperAdminGuard = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const { user, isSuperAdmin, isReady } = useAuth();

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (!isSuperAdmin) {
      toast({
        title: "Acceso denegado",
        description: "No tenés permisos para acceder a esta sección",
        variant: "destructive",
      });
      navigate("/dashboard", { replace: true });
    }
  }, [isReady, user, isSuperAdmin, navigate]);

  if (!isReady || !user || !isSuperAdmin) return <LoadingPage />;
  return <>{children}</>;
};

export default SuperAdminGuard;

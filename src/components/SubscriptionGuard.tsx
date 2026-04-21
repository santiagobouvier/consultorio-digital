import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CreditCard } from "lucide-react";
import { triggerSessionExpired } from "@/components/SessionExpiredDialog";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveBusinessId } from "@/hooks/use-business-id";

interface SubscriptionGuardProps {
  children: ReactNode;
}

// Caché a nivel módulo: businessId resuelto por userId.
// Persiste entre navegaciones a rutas protegidas (cada <Protected> remonta su
// SubscriptionGuard, pero no queremos re-ejecutar el RPC cada vez).
// Se invalida al cambiar de userId o al hacer signOut (handler abajo).
const businessIdCache = new Map<string, string | null>();
const activationCache = new Map<string, boolean>(); // businessId → ya verificado

// Limpiar cachés al cerrar sesión (un único listener a nivel módulo).
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    businessIdCache.clear();
    activationCache.clear();
  }
});

const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isSuperAdmin, isReady: authReady } = useAuth();
  const cachedBusinessId = user ? businessIdCache.get(user.id) : undefined;
  const cachedActivation = cachedBusinessId ? activationCache.get(cachedBusinessId) : undefined;
  const [businessId, setBusinessId] = useState<string | null>(cachedBusinessId ?? null);
  const [businessLoading, setBusinessLoading] = useState(cachedBusinessId === undefined);
  const [checkingActivation, setCheckingActivation] = useState(cachedActivation !== true);
  const [activationChecked, setActivationChecked] = useState(cachedActivation === true);
  const lastResolvedUserId = useRef<string | null>(cachedBusinessId !== undefined && user ? user.id : null);
  const hasSuccessfulSubscriptionRedirect = searchParams.get("subscription") === "success";

  // Resolver businessId una vez que la auth está lista.
  // Super admin: si está impersonando un business (sessionStorage), lo usa;
  // si no, redirige directo a /saas-admin sin tocar suscripciones.
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    if (isSuperAdmin) {
      const impersonated = getActiveBusinessId();
      if (impersonated) {
        setBusinessId(impersonated);
      } else {
        navigate("/saas-admin", { replace: true });
        return;
      }
      setBusinessLoading(false);
      return;
    }

    // Si ya resolvimos el businessId para este usuario en una navegación previa,
    // no volvemos a pegarle al RPC — solo restauramos el estado desde el caché.
    if (lastResolvedUserId.current === user.id && businessIdCache.has(user.id)) {
      const cached = businessIdCache.get(user.id) ?? null;
      setBusinessId(cached);
      setBusinessLoading(false);
      return;
    }

    // Usuario regular: obtener su business via RPC
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_user_business_id", { _user_id: user.id });
        if (cancelled) return;
        if (error) {
          console.error("SubscriptionGuard: error obteniendo business", error);
          triggerSessionExpired();
          return;
        }
        const resolved = (data as string | null) || null;
        businessIdCache.set(user.id, resolved);
        lastResolvedUserId.current = user.id;
        setBusinessId(resolved);
      } catch (err) {
        if (cancelled) return;
        console.error("SubscriptionGuard: excepción obteniendo business", err);
        triggerSessionExpired();
      } finally {
        if (!cancelled) setBusinessLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authReady, user, isSuperAdmin, navigate]);

  const { status, loading } = useSubscriptionStatus(businessId);

  // Verificar si el usuario en trial activó MP
  useEffect(() => {
    if (businessLoading) return;

    if (isSuperAdmin) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    if (!businessId) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    if (loading) return;

    if (status !== "trial") {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    if (hasSuccessfulSubscriptionRedirect) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data: business } = await supabase
          .from("businesses")
          .select("is_demo")
          .eq("id", businessId)
          .maybeSingle();

        if (cancelled) return;

        if (business?.is_demo) {
          setCheckingActivation(false);
          setActivationChecked(true);
          return;
        }

        // TESTING MODE — durante testing dejamos pasar a usuarios en trial
        // sin preapproval de MP. Revertir antes del lanzamiento.
        setCheckingActivation(false);
        setActivationChecked(true);
      } catch {
        if (!cancelled) {
          setCheckingActivation(false);
          setActivationChecked(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [businessId, status, loading, businessLoading, isSuperAdmin, hasSuccessfulSubscriptionRedirect]);

  if (!authReady || businessLoading) return <LoadingPage />;
  if (isSuperAdmin) return <>{children}</>;
  if (businessId && (loading || checkingActivation || !activationChecked)) return <LoadingPage />;

  // Sin business → onboarding
  if (!businessId) return <>{children}</>;

  // Activos / trial → permitido
  if (status === "active" || status === "trial") {
    return <>{children}</>;
  }

  // Bloqueado: expired, cancelled, past_due, none
  const messages: Record<string, { title: string; desc: string }> = {
    expired: {
      title: "Tu período de prueba ha terminado",
      desc: "Para seguir usando Tu Consultorio Digital, activá tu suscripción eligiendo un plan.",
    },
    cancelled: {
      title: "Tu suscripción fue cancelada",
      desc: "Reactivá tu plan para volver a acceder a todas las funcionalidades.",
    },
    past_due: {
      title: "Tu pago está pendiente",
      desc: "Actualizá tu método de pago para continuar usando la plataforma.",
    },
    none: {
      title: "No tenés una suscripción activa",
      desc: "Elegí un plan para comenzar a usar Tu Consultorio Digital.",
    },
  };

  const msg = messages[status] || messages.none;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">{msg.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{msg.desc}</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/billing")} className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              Ir a Facturación
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Volver al inicio
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionGuard;

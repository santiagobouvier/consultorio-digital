import { ReactNode, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Loader2, Sparkles, PartyPopper } from "lucide-react";
import { triggerSessionExpired } from "@/components/SessionExpiredDialog";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveBusinessId } from "@/hooks/use-business-id";
import { toast } from "sonner";

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
  const location = useLocation();
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
  const [reactivating, setReactivating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Detect successful subscription return
  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      setShowCelebration(true);
    }
  }, [searchParams]);

  const handleReactivate = useCallback(async () => {
    if (!businessId) return;
    setReactivating(true);
    try {
      // Get business plan info
      const { data: business } = await supabase
        .from("businesses")
        .select("plan_code, billing_period")
        .eq("id", businessId)
        .maybeSingle();

      if (!business?.plan_code) {
        navigate("/billing");
        return;
      }

      const { data, error } = await supabase.functions.invoke("create-subscription", {
        body: {
          plan_code: business.plan_code,
          billing_period: business.billing_period || "annual",
        },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.success("¡Cuenta reactivada!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Reactivation error:", err);
      toast.error("Error al reactivar. Intentá de nuevo.");
    } finally {
      setReactivating(false);
    }
  }, [businessId, navigate]);

  const handleDismissCelebration = useCallback(() => {
    setShowCelebration(false);
    // Clean URL param
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("subscription");
    navigate({ pathname: location.pathname, search: newParams.toString() }, { replace: true });
  }, [searchParams, navigate, location.pathname]);

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

    // Si ya verificamos activación para este business en una navegación previa,
    // no repetimos el query.
    if (activationCache.get(businessId) === true) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    if (loading) return;

    if (status !== "trial") {
      activationCache.set(businessId, true);
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    if (hasSuccessfulSubscriptionRedirect) {
      activationCache.set(businessId, true);
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
          activationCache.set(businessId, true);
          setCheckingActivation(false);
          setActivationChecked(true);
          return;
        }

        // TESTING MODE — durante testing dejamos pasar a usuarios en trial
        // sin preapproval de MP. Revertir antes del lanzamiento.
        activationCache.set(businessId, true);
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
  // TESTING MODE — también dejamos pasar "none" (negocios recién creados desde
  // el wizard que aún no tienen fila en subscriptions). Revertir antes del lanzamiento.
  if (status === "active" || status === "trial" || status === "none") {
    return (
      <>
        {showCelebration && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 p-8 text-center space-y-6 animate-scale-in"
              style={{
                backgroundColor: '#111111',
                boxShadow: '0 8px 60px rgba(0, 165, 160, 0.15)',
              }}
            >
              <div className="mx-auto w-20 h-20 rounded-full bg-[hsla(160,80%,50%,0.15)] flex items-center justify-center">
                <PartyPopper className="w-10 h-10 text-[hsl(160,80%,50%)]" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                ¡Cuenta reactivada!
              </h2>
              <p className="text-white/60">
                Podés seguir gestionando tu consultorio con todas las funcionalidades.
              </p>
              <Button
                onClick={handleDismissCelebration}
                className="w-full h-12 font-semibold text-white text-base"
                style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Ir al consultorio
              </Button>
            </div>
          </div>
        )}
        {children}
      </>
    );
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
    <div className="relative min-h-screen">
      {/* Blurred dashboard behind */}
      <div className="pointer-events-none select-none" style={{ filter: 'blur(12px)' }} aria-hidden="true">
        {children}
      </div>

      {/* Dark overlay + centered modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        <div
          className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 p-6 sm:p-8 text-center space-y-5 animate-scale-in"
          style={{
            backgroundColor: '#111111',
            boxShadow: '0 8px 60px rgba(0, 165, 160, 0.08), 0 0 120px rgba(0, 165, 160, 0.04)',
          }}
        >
          <div className="mx-auto w-16 h-16 rounded-full bg-[hsla(40,100%,60%,0.12)] flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-[hsl(40,100%,60%)]" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white">{msg.title}</h2>
          <p className="text-sm sm:text-base text-white/50">{msg.desc}</p>

          <div className="flex flex-col gap-3 pt-2">
            <Button
              onClick={handleReactivate}
              disabled={reactivating}
              className="w-full h-12 font-semibold text-white text-base"
              style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
            >
              {reactivating ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-5 h-5 mr-2" />
              )}
              {reactivating ? "Redirigiendo..." : "Reactivar cuenta"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/billing")}
              className="w-full text-white/40 hover:text-white/60"
            >
              Ver planes disponibles
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGuard;

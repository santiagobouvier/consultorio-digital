import { ReactNode, useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CreditCard, Loader2, Sparkles, PartyPopper, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessIdContext } from "@/contexts/BusinessIdContext";
import { toast } from "sonner";
import { resolveSubscriptionStatus } from "@/lib/subscription-status";

interface SubscriptionGuardProps {
  children: ReactNode;
}

const activationCache = new Map<string, boolean>(); // businessId → ya verificado
const POLL_INTERVAL = 3000; // 3 seconds
const MAX_POLL_TIME = 30000; // 30 seconds

// Limpiar caché al cerrar sesión (un único listener a nivel módulo).
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    activationCache.clear();
  }
});

const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user, isSuperAdmin, isReady: authReady } = useAuth();
  const { businessId, loading: businessLoading } = useBusinessIdContext();
  const cachedActivation = businessId ? activationCache.get(businessId) : undefined;
  const [checkingActivation, setCheckingActivation] = useState(cachedActivation !== true);
  const [activationChecked, setActivationChecked] = useState(cachedActivation === true);
  
  // Grace period: when status is "none" but we have a businessId, wait before blocking
  const [noneGraceActive, setNoneGraceActive] = useState(false);
  const noneGraceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Payment verification polling state
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);

  const { status, loading } = useSubscriptionStatus(businessId);
  const [reactivating, setReactivating] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // When status resolves to "none" with a businessId, give the DB trigger time to create the subscription
  useEffect(() => {
    if (noneGraceRef.current) {
      clearTimeout(noneGraceRef.current);
      noneGraceRef.current = null;
    }

    if (!loading && businessId && status === "none") {
      setNoneGraceActive(true);
      noneGraceRef.current = setTimeout(() => {
        setNoneGraceActive(false);
      }, 4000);
    } else {
      setNoneGraceActive(false);
    }

    return () => {
      if (noneGraceRef.current) clearTimeout(noneGraceRef.current);
    };
  }, [loading, businessId, status]);

  // When returning from Mercado Pago with ?subscription=success, poll DB to verify payment
  useEffect(() => {
    if (searchParams.get("subscription") !== "success") return;
    if (!businessId || loading || businessLoading) return;
    // If already active, just show celebration
    if (status === "active") {
      setShowCelebration(true);
      return;
    }

    // Start polling
    setVerifyingPayment(true);
    setPaymentTimedOut(false);
    let cancelled = false;
    const startTime = Date.now();

    const poll = async () => {
      while (!cancelled && Date.now() - startTime < MAX_POLL_TIME) {
        try {
          const { data: subscription } = await supabase
            .from("subscriptions")
            .select("status, trial_ends_at, current_period_end, created_at")
            .eq("business_id", businessId)
            .maybeSingle();

          if (cancelled) return;

          const resolvedStatus = resolveSubscriptionStatus(subscription);

          if (resolvedStatus === "active") {
            setVerifyingPayment(false);
            setPaymentVerified(true);
            setShowCelebration(true);
            return;
          }
        } catch (err) {
          console.error("Payment verification poll error:", err);
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
      if (!cancelled) {
        setVerifyingPayment(false);
        setPaymentTimedOut(true);
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [searchParams, businessId, status, loading, businessLoading]);

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
    setPaymentVerified(false);
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
  }, [businessId, status, loading, businessLoading, isSuperAdmin]);

  if (!authReady || businessLoading) return <LoadingPage />;
  if (isSuperAdmin) return <>{children}</>;
  if (businessId && (loading || checkingActivation || !activationChecked)) return <LoadingPage />;
  if (noneGraceActive) return <LoadingPage />;

  // Show payment verification spinner when polling
  if (verifyingPayment) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 py-8" style={{ backgroundColor: '#111111' }}>
        <div className="w-full max-w-md text-center space-y-5 sm:space-y-6">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[hsla(176,100%,32%,0.15)] flex items-center justify-center">
            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-[hsl(176,100%,32%)] animate-spin" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Verificando tu pago...</h2>
          <p className="text-sm sm:text-base text-white/50 px-2">Esto puede tardar unos segundos mientras confirmamos con Mercado Pago.</p>
        </div>
      </div>
    );
  }

  // Show timed-out message (payment not yet confirmed)
  if (paymentTimedOut) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center px-5 py-8" style={{ backgroundColor: '#111111' }}>
        <div className="w-full max-w-md text-center space-y-5 sm:space-y-6">
          <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[hsla(40,100%,60%,0.12)] flex items-center justify-center">
            <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-[hsl(40,100%,60%)]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Pago en proceso</h2>
          <p className="text-sm sm:text-base text-white/50 px-2">
            Si ya pagaste, tu acceso se activará en unos minutos. Podés recargar la página más tarde.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full h-12 font-semibold text-white text-base"
            style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
          >
            Recargar página
          </Button>
        </div>
      </div>
    );
  }

  // Sin business → onboarding
  if (!businessId) return <>{children}</>;

  // Only active and trial (with days left) get access
  if (status === "active" || status === "trial") {
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

  // Bloqueado: expired, cancelled, past_due, none — all show reactivation modal
  const messages: Record<string, { title: string; desc: string }> = {
    expired: {
      title: "Tu período de prueba ha terminado",
      desc: "Para seguir usando Tu Consultorio Digital, activá tu suscripción eligiendo un plan.",
    },
    pending: {
      title: "Tu pago todavía no fue aprobado",
      desc: "Hasta que Mercado Pago confirme el cobro, el acceso al sistema permanece bloqueado.",
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
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ backgroundColor: '#111111' }}>
      {/* Dark overlay + centered modal */}
      <div className="flex items-center justify-center w-full h-full px-5 py-8">

        <div
          className="w-full max-w-md rounded-2xl border border-white/10 p-5 sm:p-8 text-center space-y-4 sm:space-y-5 animate-scale-in"
          style={{
            backgroundColor: '#111111',
            boxShadow: '0 8px 60px rgba(0, 165, 160, 0.08), 0 0 120px rgba(0, 165, 160, 0.04)',
          }}
        >
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[hsla(40,100%,60%,0.12)] flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-[hsl(40,100%,60%)]" />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white">{msg.title}</h2>
          <p className="text-sm sm:text-base text-white/50">{msg.desc}</p>

          <div className="flex flex-col gap-3 pt-1 sm:pt-2">
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
              onClick={() => navigate("/pricing")}
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

import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionGuardProps {
  children: ReactNode;
}

const clearSessionAndRedirect = async (navigate: ReturnType<typeof useNavigate>) => {
  try {
    await supabase.auth.signOut();
  } catch (_) {}
  // Clear all local/session storage to prevent stale state
  localStorage.clear();
  sessionStorage.clear();
  toast.error("Tu sesión expiró, por favor ingresá de nuevo");
  navigate("/auth", { replace: true });
};

const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkingActivation, setCheckingActivation] = useState(true);
  const [activationChecked, setActivationChecked] = useState(false);
  const [sessionInvalid, setSessionInvalid] = useState(false);

  useEffect(() => {
    const getBusinessId = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (!user || userError) {
          // No session — just redirect to auth, no need to clear
          navigate("/auth", { replace: true });
          return;
        }

        // Verify user exists in profiles (DB state matches session)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || profileError) {
          // Session exists but user not found in DB — inconsistent state
          console.warn("SubscriptionGuard: session exists but profile not found in DB, clearing session");
          setSessionInvalid(true);
          await clearSessionAndRedirect(navigate);
          return;
        }

        // Get business via RPC
        const { data } = await supabase.rpc("get_user_business_id", { _user_id: user.id });
        setBusinessId(data || null);
        setAuthLoading(false);
      } catch (err) {
        console.error("SubscriptionGuard: unexpected error", err);
        setSessionInvalid(true);
        await clearSessionAndRedirect(navigate);
      }
    };
    getBusinessId();
  }, [navigate]);

  const { status, loading, trialDaysLeft, isSuperAdmin } = useSubscriptionStatus(businessId);

  // Check if trial user has activated with MP (has preapproval ID)
  useEffect(() => {
    if (loading || authLoading || !businessId) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    // Super admins skip this check
    if (isSuperAdmin) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    // Only check for trial status
    if (status !== "trial") {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    // If user just came from MP payment, don't block — let them through
    if (searchParams.get("subscription") === "success") {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    const checkActivation = async () => {
      // Check if business is demo
      const { data: business } = await supabase
        .from("businesses")
        .select("is_demo")
        .eq("id", businessId)
        .maybeSingle();

      if (business?.is_demo) {
        setCheckingActivation(false);
        setActivationChecked(true);
        return;
      }

      // Check if subscription has MP preapproval
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("mercadopago_preapproval_id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sub?.mercadopago_preapproval_id) {
        // No MP activation — redirect to activate trial
        navigate("/activar-prueba", { replace: true });
        return;
      }

      setCheckingActivation(false);
      setActivationChecked(true);
    };

    checkActivation();
  }, [businessId, status, loading, authLoading, isSuperAdmin, navigate]);

  if (sessionInvalid) return <LoadingPage />;
  if (authLoading || loading || checkingActivation || !activationChecked) return <LoadingPage />;

  // No business yet — let them through to setup
  if (!businessId) return <>{children}</>;

  // Super admin, active, trial — allowed
  if (isSuperAdmin || status === "active" || status === "trial") {
    return <>{children}</>;
  }

  // Blocked: expired, cancelled, past_due, none
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

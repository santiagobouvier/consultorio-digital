import { ReactNode, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSubscriptionStatus } from "@/hooks/use-subscription-status";
import LoadingPage from "@/components/LoadingPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CreditCard } from "lucide-react";
import { hardResetBrowserSession } from "@/lib/session-recovery";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";

interface SubscriptionGuardProps {
  children: ReactNode;
}

const SubscriptionGuard = ({ children }: SubscriptionGuardProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [checkingActivation, setCheckingActivation] = useState(true);
  const [activationChecked, setActivationChecked] = useState(false);
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [directIsSuperAdmin, setDirectIsSuperAdmin] = useState(false);
  const hasSuccessfulSubscriptionRedirect = searchParams.get("subscription") === "success";

  useEffect(() => {
    const getBusinessId = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          setSessionInvalid(true);
          await hardResetBrowserSession({ redirectTo: "/auth?session=expired" });
          return;
        }

        if (!user) {
          // No session — just redirect to auth, no need to clear
          navigate("/auth", { replace: true });
          return;
        }

        const isSuperAdmin = await isCurrentUserSuperAdmin(user.id);

        if (isSuperAdmin) {
          setDirectIsSuperAdmin(true);
          setBusinessId(null);
          setCheckingActivation(false);
          setActivationChecked(true);
          setAuthLoading(false);
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
          await hardResetBrowserSession({ redirectTo: "/auth?session=expired" });
          return;
        }

        // Get business via RPC
        const { data } = await supabase.rpc("get_user_business_id", { _user_id: user.id });
        setBusinessId(data || null);
        setAuthLoading(false);
      } catch (err) {
        console.error("SubscriptionGuard: unexpected error", err);
        setSessionInvalid(true);
        await hardResetBrowserSession({ redirectTo: "/auth?session=expired" });
      }
    };
    getBusinessId();
  }, [navigate]);

  const { status, loading, isSuperAdmin } = useSubscriptionStatus(businessId);

  // Safety timeout: si después de 5 segundos no resolvió, hard reset
  useEffect(() => {
    if (sessionInvalid || directIsSuperAdmin) return;
    const timer = setTimeout(() => {
      if (authLoading || (businessId && (loading || checkingActivation || !activationChecked))) {
        console.warn("SubscriptionGuard: timeout de 5s alcanzado, forzando hard reset");
        hardResetBrowserSession({ redirectTo: "/auth?session=expired" });
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [authLoading, loading, checkingActivation, activationChecked, businessId, sessionInvalid, directIsSuperAdmin]);

  // Check if trial user has activated with MP (has preapproval ID)
  useEffect(() => {
    if (authLoading) return;

    if (directIsSuperAdmin) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    // Sin businessId: dejar pasar inmediatamente (onboarding)
    if (!businessId) {
      setCheckingActivation(false);
      setActivationChecked(true);
      return;
    }

    if (loading) {
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
    if (hasSuccessfulSubscriptionRedirect) {
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

      // Check subscription status and MP preapproval
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, mercadopago_preapproval_id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Allow access if subscription is active (manually activated) OR has MP preapproval
      if (sub?.status !== "active" && !sub?.mercadopago_preapproval_id) {
        // No activation — redirect to activate trial
        navigate("/activar-prueba", { replace: true });
        return;
      }

      setCheckingActivation(false);
      setActivationChecked(true);
    };

    checkActivation();
  }, [businessId, status, loading, authLoading, isSuperAdmin, navigate, hasSuccessfulSubscriptionRedirect, directIsSuperAdmin]);

  if (sessionInvalid) return <LoadingPage />;
  if (authLoading) return <LoadingPage />;
  if (directIsSuperAdmin) return <>{children}</>;
  // Si hay businessId, esperar también al status de suscripción y la verificación de activación
  if (businessId && (loading || checkingActivation || !activationChecked)) return <LoadingPage />;

  // No business yet — let them through to setup
  if (!businessId) return <>{children}</>;

  // Super admin, active, trial — allowed
  if (directIsSuperAdmin || isSuperAdmin || status === "active" || status === "trial") {
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

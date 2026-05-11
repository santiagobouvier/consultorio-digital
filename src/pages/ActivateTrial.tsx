import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getPlanDefinition, formatPrice } from "@/lib/plan-definitions";
import LoadingPage from "@/components/LoadingPage";
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";
import { resolveSubscriptionStatus } from "@/lib/subscription-status";

const ActivateTrial = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState<string>("emprendedor");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");

  useEffect(() => {
    let cancelled = false;

    const checkState = async () => {
      // Wait for session to be ready (avoid race with token exchange)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // Don't redirect immediately — wait for auth to settle
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === "SIGNED_IN" && newSession?.user && !cancelled) {
            subscription.unsubscribe();
            runCheck(newSession.user.id);
          }
        });
        // Timeout: if no session after 8s, redirect to auth
        setTimeout(() => {
          subscription.unsubscribe();
          if (!cancelled) navigate("/auth", { replace: true });
        }, 8000);
        return;
      }

      await runCheck(session.user.id);
    };

    const runCheck = async (userId: string) => {
      if (cancelled) return;

      const isSuperAdmin = await isCurrentUserSuperAdmin(userId);

      if (cancelled) return;
      if (isSuperAdmin) {
        navigate("/saas-admin", { replace: true });
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id, plan_code, billing_period, onboarding_completed")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (!business) { navigate("/configurar-negocio", { replace: true }); return; }
      if (!business.onboarding_completed) { navigate("/onboarding-consultorio", { replace: true }); return; }

      // Check if already has an activated subscription/trial
      // Polling: re-verificar hasta 3 veces (cubre timing de activación manual)
      let resolvedStatus: string | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const { data } = await supabase
          .from("subscriptions")
          .select("status, trial_ends_at, current_period_end, created_at")
          .eq("business_id", business.id)
            .maybeSingle();

        if (cancelled) return;
        resolvedStatus = resolveSubscriptionStatus(data);

        if (resolvedStatus === "active" || resolvedStatus === "trial") {
          navigate("/dashboard", { replace: true });
          return;
        }

        // Wait 1s antes de reintentar (excepto último)
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
      }

      setBusinessId(business.id);
      setPlanCode(business.plan_code || "emprendedor");
      setBillingPeriod((business.billing_period as "monthly" | "annual") || "annual");
      setLoading(false);
    };

    checkState();
    return () => { cancelled = true; };
  }, [navigate]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      if (!businessId) throw new Error("Business no encontrado");

      // Check if a subscription already exists (trigger auto-creates it on business insert)
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("business_id", businessId)
        .maybeSingle();

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      if (!existing) {
        const { error: insertErr } = await supabase.from("subscriptions").insert({
          business_id: businessId,
          plan_code: planCode,
          billing_period: billingPeriod,
          status: "trial",
          amount: 0,
          currency: "UYU",
          trial_ends_at: trialEnd.toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: trialEnd.toISOString(),
        });
        if (insertErr) throw insertErr;
      } else if (existing.status !== "trial" && existing.status !== "active") {
        const { error: updateErr } = await supabase
          .from("subscriptions")
          .update({
            status: "trial",
            trial_ends_at: trialEnd.toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: trialEnd.toISOString(),
          })
          .eq("id", existing.id);
        if (updateErr) throw updateErr;
      }

      toast.success("¡Prueba gratis activada! Tenés 7 días para probar todo.");
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Activation error:", err);
      toast.error("Error al activar la prueba. Intentá de nuevo.");
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <LoadingPage />;

  const plan = getPlanDefinition(planCode);
  const price = billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonthly;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(180,15%,4%)] p-4">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Logo variant="full" size="4xl" showTagline={false} />
        </div>

        <div
          className="rounded-2xl border border-white/10 shadow-2xl"
          style={{
            backgroundColor: '#111111',
            boxShadow: '0 8px 60px rgba(0, 165, 160, 0.08), 0 0 120px rgba(0, 165, 160, 0.04)',
          }}
        >
          <div className="p-6 text-center space-y-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-[hsl(176,80%,40%)]" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              7 días gratis, cancelá cuando quieras
            </h2>
            <p className="text-sm text-white/50">
              Activá tu prueba en un clic. Sin tarjeta, sin compromiso.
            </p>
          </div>

          <div className="px-6 pb-2">
            {/* Plan info */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/50">Plan seleccionado</p>
                  <p className="font-semibold text-white">{plan.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white/60">Al vencer los 7 días, elegís si querés continuar</p>
                </div>
              </div>
            </div>

            {/* Trust bullets */}
            <div className="space-y-3 mb-6">
              {[
                { icon: Check, text: "Sin tarjeta de crédito" },
                { icon: Check, text: "7 días para probar todas las funcionalidades" },
                { icon: Check, text: "Al vencer, elegís un plan y pagás" },
                { icon: Check, text: "Podés cambiar de plan cuando quieras" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[hsla(160,80%,50%,0.15)] flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-3 h-3 text-[hsl(160,80%,50%)]" />
                  </div>
                  <span className="text-sm text-white/70">{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 pb-6 space-y-3">
            <Button
              onClick={handleActivate}
              disabled={activating}
              className="w-full h-12 font-semibold text-white text-base"
              style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
            >
              {activating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Activando...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Empezar prueba gratis de 7 días
                </>
              )}
            </Button>

            <a
              href="https://wa.me/59891093977?text=Hola%2C%20tengo%20una%20consulta%20sobre%20Consultorio%20Digital"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors py-2"
            >
              <MessageCircle className="w-4 h-4" />
              ¿Tenés dudas? Contactanos por WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivateTrial;

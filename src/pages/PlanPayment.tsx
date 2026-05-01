import { useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CreditCard, Loader2, AlertCircle, MessageCircle } from "lucide-react";
import { getPlanDefinition, formatPrice, normalizePlanCode } from "@/lib/plan-definitions";


const PlanPayment = () => {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams] = useSearchParams();
  const billingPeriod = (searchParams.get("period") as "monthly" | "annual") || "annual";
  const skipTrial = searchParams.get("skip_trial") === "true";

  const normalizedPlan = planId ? normalizePlanCode(planId) : "emprendedor";
  const plan = getPlanDefinition(normalizedPlan);
  const price = billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonthly;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-subscription", {
        body: {
          plan_code: normalizedPlan,
          billing_period: billingPeriod,
        },
      });

      if (fnError) throw fnError;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError("No se pudo generar el link de pago. Intentá de nuevo.");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setError("Ocurrió un error al procesar el pago. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: 'hsl(180, 15%, 4%)' }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.1), transparent)" }}
      />
      <div
        className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-2xl border border-white/10"
        style={{
          backgroundColor: "#111111",
          boxShadow: '0 8px 60px rgba(0, 165, 160, 0.08)',
        }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 mb-6 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Link>

        <h1 className="text-2xl font-bold text-white mb-1">Plan {plan.name}</h1>
        <p className="text-white/50 text-sm mb-6">{plan.description}</p>

        {/* Plan price card */}
        <div
          className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Precio</p>
              <p className="text-lg font-bold text-white">{formatPrice(price)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">
                /mes {billingPeriod === "annual" ? "(pago anual)" : "(pago mensual)"}
              </p>
              {!skipTrial && (
                <p className="text-xs text-[hsl(160,80%,50%)] mt-1">7 días gratis</p>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full h-12 font-semibold text-white text-base"
            style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <CreditCard className="w-5 h-5 mr-2" />
            )}
            {loading ? "Generando link de pago..." : "Ir a Mercado Pago"}
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
  );
};

export default PlanPayment;

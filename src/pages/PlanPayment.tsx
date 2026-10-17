import { useParams, useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPrice, getAnnualTotal, getPlanDefinition, normalizePlanCode } from "@/lib/plan-definitions";
import { supportWhatsAppUrl } from "@/lib/support-whatsapp";

// /pago-plan/:planId — la suscripción a Consultorio Digital se cobra POR FUERA
// de la aplicación (oct. 2026): esta pantalla ya no genera un checkout de
// Mercado Pago. Muestra el plan y abre WhatsApp para coordinarlo con Santiago.
const PlanPayment = () => {
  const { planId } = useParams<{ planId: string }>();
  const [searchParams] = useSearchParams();
  const billingPeriod = (searchParams.get("period") as "monthly" | "annual") || "annual";

  const normalizedPlan = planId ? normalizePlanCode(planId) : "emprendedor";
  const plan = getPlanDefinition(normalizedPlan);
  const isAnnual = billingPeriod === "annual";
  const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;
  const waUrl = supportWhatsAppUrl(
    `¡Hola! Me interesa el plan ${plan.name} de Consultorio Digital (${
      isAnnual ? `pago anual de ${formatPrice(getAnnualTotal(normalizedPlan))}` : "pago mensual"
    }). ¿Me contás cómo empezar?`,
  );

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

        <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">Precio</p>
              <p className="text-lg font-bold text-white">{formatPrice(price)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40">/mes {isAnnual ? "(pago anual)" : "(pago mensual)"}</p>
              {isAnnual && (
                <p className="text-xs text-white/40 mt-1">pago anual de {formatPrice(getAnnualTotal(normalizedPlan))}</p>
              )}
            </div>
          </div>
        </div>

        <p className="text-sm text-white/60 mb-4">
          Los planes se coordinan con nosotros por WhatsApp. El pago se hace por fuera de la
          plataforma y, una vez acreditado, activamos tu acceso.
        </p>

        <Button
          asChild
          className="w-full h-12 font-semibold text-white text-base"
          style={{ backgroundColor: '#00a5a0', boxShadow: '0 4px 20px rgba(0,165,160,0.3)' }}
        >
          <a href={waUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="w-5 h-5 mr-2" />
            Coordinar por WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
};

export default PlanPayment;

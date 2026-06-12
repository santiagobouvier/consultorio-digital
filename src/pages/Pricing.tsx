import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Check,
  Users,
  UserCheck,
  Globe,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import {
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  formatPrice,
  type PlanDefinition,
} from "@/lib/plan-definitions";

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  const handleSelectPlan = useCallback(
    (planCode: string) => {
      if (!user) {
        // Not logged in → go to register with plan preselected (no Mercado Pago)
        navigate(`/auth?plan=${planCode}&billing=${billingCycle}`);
        return;
      }
      // Logged in → go to dashboard (trial is already active or user can manage from billing)
      navigate("/dashboard");
    },
    [user, billingCycle, navigate]
  );

  const plans = PLAN_ORDER.map((code) => PLAN_DEFINITIONS[code]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(180,15%,4%)" }}>
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, hsla(176,80%,40%,0.08), transparent)",
        }}
        aria-hidden
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Elegí el plan ideal para tu consultorio
          </h1>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl mx-auto">
            Todos los planes incluyen 15 días de prueba gratis. Sin compromiso, cancelá cuando quieras.
          </p>
        </div>

        {/* Billing toggle */}
        {/* No-card trust banner */}
        <div className="max-w-3xl mx-auto mb-8">
          <div
            className="relative rounded-2xl border p-5 sm:p-6 flex items-start sm:items-center gap-4 overflow-hidden"
            style={{
              backgroundColor: "hsla(176,80%,40%,0.08)",
              borderColor: "hsla(176,80%,40%,0.35)",
              boxShadow: "0 8px 32px hsla(176,80%,40%,0.12)",
            }}
          >
            <div
              className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center border"
              style={{
                backgroundColor: "hsla(176,80%,40%,0.15)",
                borderColor: "hsla(176,80%,40%,0.4)",
              }}
            >
              <ShieldCheck
                className="w-6 h-6 sm:w-7 sm:h-7"
                style={{ color: "hsl(176,80%,55%)" }}
                strokeWidth={2}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-base sm:text-lg font-bold mb-1"
                style={{ color: "hsl(176,80%,75%)" }}
              >
                Importante: no pedimos tarjeta para los 15 días gratis
              </div>
              <p className="text-sm text-white/70 leading-snug">
                Probá todo el sistema sin riesgo. No vas a ingresar ningún dato de pago hasta que decidas continuar. Dale sin miedo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              billingCycle === "monthly"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Mensual
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              billingCycle === "annual"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Anual
            <Badge
              className="text-[10px] px-1.5 py-0 border-0"
              style={{
                backgroundColor: "hsla(160,80%,50%,0.15)",
                color: "hsl(160,80%,50%)",
              }}
            >
              Ahorrá 20%
            </Badge>
          </button>
        </div>

        {/* Plan cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              billingCycle={billingCycle}
              onSelect={() => handleSelectPlan(plan.code)}
            />
          ))}
        </div>

        {/* Footer note */}
        <p className="text-center text-white/30 text-xs mt-10">
          Precios en pesos uruguayos (UYU). IVA incluido. Empezá gratis sin tarjeta.
        </p>
      </div>
    </div>
  );
};

/* ─── Plan Card ─── */

interface PlanCardProps {
  plan: PlanDefinition;
  billingCycle: "monthly" | "annual";
  onSelect: () => void;
}

const PlanCard = ({ plan, billingCycle, onSelect }: PlanCardProps) => {
  const price = billingCycle === "annual" ? plan.priceAnnual : plan.priceMonthly;
  const monthlyPrice = plan.priceMonthly;
  const isAnnual = billingCycle === "annual";
  const highlighted = plan.isHighlighted;

  const savings = isAnnual
    ? Math.round(((monthlyPrice - plan.priceAnnual) / monthlyPrice) * 100)
    : 0;

  return (
    <div
      className={`relative rounded-2xl border p-6 flex flex-col transition-all ${
        highlighted
          ? "border-[hsla(176,80%,40%,0.5)] scale-[1.02]"
          : "border-white/10 hover:border-white/20"
      }`}
      style={{
        backgroundColor: "#111111",
        boxShadow: highlighted
          ? "0 8px 40px rgba(0, 165, 160, 0.12)"
          : "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Highlight badge */}
      {highlighted && plan.highlightLabel && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge
            className="px-3 py-1 text-xs font-semibold border-0"
            style={{
              backgroundColor: "hsl(176,80%,40%)",
              color: "#111111",
            }}
          >
            <Sparkles className="w-3 h-3 mr-1" />
            {plan.highlightLabel}
          </Badge>
        </div>
      )}

      {/* Plan name & description */}
      <div className="mb-5">
        <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
        <p className="text-sm text-white/40 leading-snug">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">{formatPrice(price)}</span>
          <span className="text-sm text-white/40">/mes</span>
        </div>
        {isAnnual && savings > 0 && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-white/30 line-through">
              {formatPrice(monthlyPrice)}/mes
            </span>
            <Badge
              className="text-[10px] px-1.5 py-0 border-0"
              style={{
                backgroundColor: "hsla(160,80%,50%,0.12)",
                color: "hsl(160,80%,50%)",
              }}
            >
              -{savings}%
            </Badge>
          </div>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6 flex-1">
        <FeatureItem
          icon={<UserCheck className="w-4 h-4" />}
          text={
            plan.maxProfessionals === null
              ? "Profesionales ilimitados"
              : `${plan.maxProfessionals} profesional${plan.maxProfessionals > 1 ? "es" : ""}`
          }
        />
        <FeatureItem
          icon={<Users className="w-4 h-4" />}
          text={
            plan.maxPatients === null
              ? "Pacientes ilimitados"
              : `Hasta ${plan.maxPatients} pacientes`
          }
        />
        {plan.hasPublicWeb && (
          <FeatureItem
            icon={<Globe className="w-4 h-4" />}
            text="Web pública del consultorio"
          />
        )}
        <FeatureItem icon={<Check className="w-4 h-4" />} text="Agenda inteligente" />
        <FeatureItem icon={<Check className="w-4 h-4" />} text="Gestión de pagos" />
        <FeatureItem icon={<Check className="w-4 h-4" />} text="Portal de pacientes" />
      </ul>

      {/* CTA */}
      <Button
        onClick={onSelect}
        className="w-full h-11 font-semibold text-sm"
        style={
          highlighted
            ? {
                backgroundColor: "hsl(176,80%,40%)",
                color: "#111111",
                boxShadow: "0 4px 20px rgba(0,165,160,0.3)",
              }
            : {
                backgroundColor: "hsla(176,80%,40%,0.12)",
                color: "hsl(176,80%,40%)",
              }
        }
      >
        Empezar 15 días gratis
      </Button>
    </div>
  );
};

const FeatureItem = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <li className="flex items-center gap-2.5 text-sm text-white/60">
    <span className="text-[hsl(176,80%,40%)] shrink-0">{icon}</span>
    {text}
  </li>
);

export default Pricing;
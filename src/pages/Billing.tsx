import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CreditCard,
  Calendar,
  Users,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Sparkles,
  Loader2,
  Check,
  ArrowUpRight,
} from "lucide-react";
import {
  getPlanDefinition,
  formatPrice,
  PLAN_DEFINITIONS,
  PLAN_ORDER,
  normalizePlanCode,
  type PlanDefinition,
} from "@/lib/plan-definitions";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Subscription {
  id: string;
  plan_code: string;
  status: string;
  billing_period: string;
  amount: number;
  currency: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  mercadopago_preapproval_id: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  trial: { label: "Prueba gratuita", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: Sparkles },
  active: { label: "Activa", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2 },
  past_due: { label: "Pago pendiente", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  cancelled: { label: "Cancelada", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle },
  expired: { label: "Expirada", color: "bg-gray-500/20 text-gray-400 border-gray-500/30", icon: Clock },
};

const Billing = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState<{
    profCount: number;
    patientCount: number;
  }>({ profCount: 0, patientCount: 0 });
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "annual">("annual");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      toast.success("¡Suscripción activada exitosamente!");
    }
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: business } = await supabase
        .from("businesses")
        .select("id, plan_code")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) { navigate("/dashboard"); return; }
      setBusinessId(business.id);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(sub as Subscription | null);

      const { count: profCount } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .in("role", ["owner", "professional"]);

      const { count: patientCount } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .eq("is_active", true);

      setBusinessInfo({
        profCount: profCount || 0,
        patientCount: patientCount || 0,
      });
    } catch (error) {
      console.error("Error fetching billing:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planCode: string) => {
    if (!businessId) return;
    setCheckoutLoading(planCode);

    try {
      const { data, error } = await supabase.functions.invoke("create-subscription", {
        body: {
          plan_code: planCode,
          billing_period: selectedBilling,
        },
      });

      if (error) throw error;

      if (data?.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast.success("Suscripción creada. Tu trial de 7 días está activo.");
        setShowPlanModal(false);
        fetchBillingData();
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error(err.message || "Error al procesar el pago. Intentá nuevamente.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(180,15%,4%)] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(176,80%,40%)] border-t-transparent" />
      </div>
    );
  }

  const plan = subscription ? getPlanDefinition(subscription.plan_code) : null;
  const currentPlanCode = subscription ? normalizePlanCode(subscription.plan_code) : null;
  const status = subscription ? statusConfig[subscription.status] || statusConfig.expired : null;
  const StatusIcon = status?.icon || Clock;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return format(new Date(dateStr), "d 'de' MMMM, yyyy", { locale: es });
  };

  const daysLeftInTrial = () => {
    if (!subscription?.trial_ends_at) return 0;
    const diff = new Date(subscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  return (
    <div className="min-h-screen bg-[hsl(180,15%,4%)] text-white">
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 40% at 50% 0%, hsla(176,80%,40%,0.06), transparent)" }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al dashboard
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold mb-8">Facturación</h1>

        {!subscription ? (
          <Card className="bg-[#111111] border-white/10">
            <CardContent className="p-8 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-white/30" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin suscripción activa</h3>
              <p className="text-white/50 text-sm mb-6">Elegí un plan para empezar a usar tu consultorio digital.</p>
              <Button
                onClick={() => setShowPlanModal(true)}
                style={{ backgroundColor: '#00a5a0' }}
                className="text-white"
              >
                Elegir plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Status + Plan Card */}
            <Card className="bg-[#111111] border-white/10">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">Tu suscripción</CardTitle>
                  <Badge variant="outline" className={`${status?.color} border`}>
                    <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
                    {status?.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold text-xl">Plan {plan?.name}</p>
                    <p className="text-white/50 text-sm">{plan?.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{formatPrice(subscription.amount)}</p>
                    <p className="text-white/50 text-xs">/ mes ({subscription.billing_period === "annual" ? "pago anual" : "pago mensual"})</p>
                  </div>
                </div>

                {subscription.status === "trial" && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-400">
                          Te quedan {daysLeftInTrial()} días de prueba gratuita
                        </p>
                        <p className="text-xs text-white/50">
                          Tu prueba termina el {formatDate(subscription.trial_ends_at)}. Activá tu método de pago para continuar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Separator className="bg-white/10" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 mt-0.5 text-white/30" />
                    <div>
                      <p className="text-xs text-white/50">Inicio del periodo</p>
                      <p className="text-sm text-white">{formatDate(subscription.current_period_start)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 mt-0.5 text-white/30" />
                    <div>
                      <p className="text-xs text-white/50">Próximo cobro</p>
                      <p className="text-sm text-white">{formatDate(subscription.current_period_end)}</p>
                    </div>
                  </div>
                </div>

                {subscription.cancelled_at && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-sm text-red-400">
                      Suscripción cancelada el {formatDate(subscription.cancelled_at)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Card */}
            <Card className="bg-[#111111] border-white/10">
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-lg">Uso actual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center">
                      <UserCheck className="w-5 h-5 text-[hsl(176,80%,40%)]" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">Profesionales</p>
                      <p className="text-lg font-semibold text-white">
                        {businessInfo.profCount}
                        <span className="text-white/30 text-sm font-normal">
                          {" "}/ {plan?.maxProfessionals ?? "∞"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[hsla(176,80%,40%,0.1)] flex items-center justify-center">
                      <Users className="w-5 h-5 text-[hsl(176,80%,40%)]" />
                    </div>
                    <div>
                      <p className="text-xs text-white/50">Pacientes activos</p>
                      <p className="text-lg font-semibold text-white">
                        {businessInfo.patientCount}
                        <span className="text-white/30 text-sm font-normal">
                          {" "}/ {plan?.maxPatients ?? "∞"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-[#111111] border-white/10">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                    onClick={() => setShowPlanModal(true)}
                  >
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Cambiar plan
                  </Button>
                  {subscription.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                      onClick={() => toast.info("La cancelación se implementará próximamente.")}
                    >
                      Cancelar suscripción
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Plan Selection Modal */}
      <Dialog open={showPlanModal} onOpenChange={setShowPlanModal}>
        <DialogContent className="max-w-3xl bg-[#0a0a0a] border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Elegí tu plan</DialogTitle>
            <DialogDescription className="text-white/50">
              {currentPlanCode
                ? `Actualmente estás en el plan ${plan?.name}. Elegí un nuevo plan.`
                : "Todos los planes incluyen 7 días de prueba gratuita."}
            </DialogDescription>
          </DialogHeader>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2 my-4">
            <button
              onClick={() => setSelectedBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedBilling === "monthly"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Mensual
            </button>
            <button
              onClick={() => setSelectedBilling("annual")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedBilling === "annual"
                  ? "bg-[hsla(176,80%,40%,0.15)] text-[hsl(176,80%,40%)]"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              Anual
              <span className="ml-1.5 text-xs text-[hsl(176,80%,40%)]">-20%</span>
            </button>
          </div>

          {/* Plan cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLAN_ORDER.map((code) => {
              const p = PLAN_DEFINITIONS[code];
              const price = selectedBilling === "annual" ? p.priceAnnual : p.priceMonthly;
              const isCurrent = code === currentPlanCode;
              const isLoading = checkoutLoading === code;

              return (
                <div
                  key={code}
                  className={`relative rounded-xl border p-5 transition-all ${
                    isCurrent
                      ? "border-[hsl(176,80%,40%)]/50 bg-[hsla(176,80%,40%,0.05)]"
                      : p.isHighlighted
                      ? "border-[#00c78a]/30 bg-[rgba(0,199,138,0.03)]"
                      : "border-white/10 bg-[#111] hover:border-white/20"
                  }`}
                >
                  {p.isHighlighted && !isCurrent && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-semibold text-black bg-[#00c78a]">
                      {p.highlightLabel}
                    </div>
                  )}
                  {isCurrent && (
                    <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-semibold text-white bg-[hsl(176,80%,40%)]">
                      Plan actual
                    </div>
                  )}

                  <h4 className="font-semibold text-white text-lg mb-1">{p.name}</h4>
                  <p className="text-white/40 text-xs mb-3">{p.description}</p>

                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">{formatPrice(price)}</span>
                    <span className="text-white/40 text-xs ml-1">/ mes</span>
                  </div>

                  <div className="space-y-1.5 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-white/60">
                      <Check className="w-3.5 h-3.5 text-[#00c78a]" />
                      <span>{p.maxProfessionals ?? "∞"} profesional{(p.maxProfessionals ?? 2) > 1 ? "es" : ""}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/60">
                      <Check className="w-3.5 h-3.5 text-[#00c78a]" />
                      <span>Hasta {p.maxPatients ?? "∞"} pacientes</span>
                    </div>
                  </div>

                  <Button
                    className="w-full text-sm"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || !!checkoutLoading}
                    onClick={() => handleSelectPlan(code)}
                    style={
                      !isCurrent
                        ? { backgroundColor: "#00a5a0", color: "white" }
                        : { borderColor: "rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)" }
                    }
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isCurrent ? (
                      "Plan actual"
                    ) : (
                      "Elegir plan"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Billing;

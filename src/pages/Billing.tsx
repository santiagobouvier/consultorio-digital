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
  Shield,
  Lock,
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
import { isCurrentUserSuperAdmin } from "@/lib/admin-access";

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
  const [, setNowTick] = useState(0);

  useEffect(() => {
    if (searchParams.get("subscription") === "success") {
      toast.success("¡Suscripción activada exitosamente!");
    }
    fetchBillingData();
  }, []);

  // Re-render every minute so the trial countdown stays accurate while viewing
  useEffect(() => {
    const interval = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const fetchBillingData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const isSuperAdmin = await isCurrentUserSuperAdmin(user.id);
      if (isSuperAdmin) {
        navigate("/saas-admin", { replace: true });
        return;
      }

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

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      subscription?.status === "trial"
        ? "¿Seguro que querés cancelar tu prueba gratuita? No se realizó ningún cobro."
        : "¿Seguro que querés cancelar tu suscripción?"
    );
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      if (error) throw error;

      if (subscription?.status === "trial") {
        toast.success("Tu prueba fue cancelada. No se realizó ningún cobro.");
        navigate("/");
      } else {
        toast.success("Suscripción cancelada correctamente.");
        fetchBillingData();
      }
    } catch (err: any) {
      console.error("Cancel error:", err);
      toast.error("Error al cancelar. Intentá de nuevo.");
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

  const trialTimeLeft = (): { label: string; expired: boolean } => {
    if (!subscription?.trial_ends_at) return { label: "0 días", expired: true };
    const diffMs = new Date(subscription.trial_ends_at).getTime() - Date.now();
    if (diffMs <= 0) return { label: "Prueba finalizada", expired: true };

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days >= 1) {
      const dLabel = `${days} día${days === 1 ? "" : "s"}`;
      const hLabel = hours > 0 ? ` y ${hours} h` : "";
      return { label: `${dLabel}${hLabel}`, expired: false };
    }
    if (hours >= 1) {
      return { label: `${hours} h ${minutes} min`, expired: false };
    }
    return { label: `${minutes} min`, expired: false };
  };

  const trial = trialTimeLeft();

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

        <h1 className="text-2xl sm:text-3xl font-bold mb-8 inline-flex items-center gap-2">
          Facturación
          <HelpTooltip id="billing" />
        </h1>

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
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1.5">
                        <p className="text-sm font-medium text-blue-400">
                          {trial.expired
                            ? "Tu prueba gratuita terminó"
                            : `Te quedan ${trial.label} de prueba gratuita`}
                        </p>
                        {!trial.expired && (
                          <p className="text-xs text-white/60 leading-relaxed">
                            No tenés que hacer nada: cuando termine, tu plan se activa automáticamente con el método de pago que registraste. Si querés cancelar, podés hacerlo en cualquier momento desde acá.
                          </p>
                        )}
                        <p className="text-xs text-white/40">
                          Tu prueba termina el {formatDate(subscription.trial_ends_at)}.
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

            {/* Payment Method Card */}
            <Card className="bg-[#111111] border-white/10">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-lg">Método de pago</CardTitle>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/40">
                    <Lock className="w-3 h-3" />
                    <span>Encriptado</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Card preview */}
                {subscription.mercadopago_preapproval_id ? (
                  <div className="relative rounded-xl bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-5 border border-white/5 overflow-hidden">
                    {/* Card chip */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-10 h-7 rounded bg-gradient-to-br from-yellow-400/80 to-yellow-600/60 border border-yellow-500/30" />
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full bg-red-500/80" />
                        <div className="w-5 h-5 rounded-full bg-yellow-500/60 -ml-2" />
                      </div>
                    </div>
                    {/* Masked number */}
                    <p className="font-mono text-lg tracking-[0.2em] text-white/80 mb-4">
                      •••• •••• •••• ••••
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Titular</p>
                        <p className="text-xs text-white/60">Gestionado por Mercado Pago</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-white/30 uppercase tracking-wider">Estado</p>
                        <p className="text-xs text-green-400">Vinculada</p>
                      </div>
                    </div>
                    {/* Decorative circles */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/[0.02]" />
                    <div className="absolute -right-4 -bottom-12 w-40 h-40 rounded-full bg-white/[0.015]" />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                    <CreditCard className="w-8 h-8 mx-auto mb-2 text-white/20" />
                    <p className="text-sm text-white/40 mb-3">
                      No hay método de pago registrado
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setShowPlanModal(true)}
                      style={{ backgroundColor: '#00a5a0' }}
                      className="text-white text-xs"
                    >
                      Agregar método de pago
                    </Button>
                  </div>
                )}

                {/* Security badges */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[hsl(176,80%,40%)]" />
                      <span className="text-[10px] text-white/40">PCI DSS</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[hsl(176,80%,40%)]" />
                      <span className="text-[10px] text-white/40">SSL 256-bit</span>
                    </div>
                  </div>
                  {/* Mercado Pago badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#009ee3]/10 border border-[#009ee3]/20">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="11" fill="#009ee3" />
                      <path d="M7 12.5C7 10 9 8 12 8s5 2 5 4.5S15 17 12 17s-5-2-5-4.5z" fill="white" opacity="0.9" />
                    </svg>
                    <span className="text-[10px] font-medium text-[#009ee3]">Mercado Pago</span>
                  </div>
                </div>

                <p className="text-[10px] text-white/25 leading-relaxed">
                  Tu información de pago es procesada de forma segura por Mercado Pago. 
                  Nunca almacenamos datos de tarjetas en nuestros servidores. 
                  Solo podés eliminar tu método de pago desde tu cuenta de Mercado Pago.
                </p>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="bg-[#111111] border-white/10">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 bg-white text-black hover:bg-white/90"
                    onClick={() => setShowPlanModal(true)}
                  >
                    <ArrowUpRight className="w-4 h-4 mr-2" />
                    Cambiar plan
                  </Button>
                  {subscription.status !== "cancelled" && (
                    <Button
                      variant="outline"
                      className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10"
                      onClick={handleCancelSubscription}
                    >
                      {subscription.status === "trial" ? "Cancelar prueba gratuita" : "Cancelar suscripción"}
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
                    {p.hasPublicWeb && (
                      <div className="flex items-center gap-2 text-white/60">
                        <Check className="w-3.5 h-3.5 text-[#00c78a]" />
                        <span>Web pública incluida</span>
                      </div>
                    )}
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

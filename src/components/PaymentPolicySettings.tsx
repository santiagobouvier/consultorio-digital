import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Save,
  Unlink,
  ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

type PolicyType = "none" | "optional" | "required";

interface PaymentPolicy {
  id?: string;
  business_id: string;
  policy_type: PolicyType;
  deposit_percentage: number | null;
  mp_access_token: string | null;
  mp_public_key: string | null;
}

interface Props {
  businessId: string;
}

const MP_REDIRECT_URI = "https://consultoriodigital.app/billing?mp_connected=true";

export const PaymentPolicySettings = ({ businessId }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(false);

  const [policyType, setPolicyType] = useState<PolicyType>("none");
  // Tarifa única del consultorio (se configura en la pestaña General);
  // acá solo se usa para mostrar cuánto pagaría el paciente de seña.
  const [sessionPrice, setSessionPrice] = useState(0);
  const [depositPercentage, setDepositPercentage] = useState(50);
  const [chargeType, setChargeType] = useState<"full" | "deposit">("full");
  const [mpConnected, setMpConnected] = useState(false);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [mpAppId, setMpAppId] = useState<string | null>(null);

  useEffect(() => {
    loadPolicy();
    loadMpConfig();
  }, [businessId]);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    const mpConnectedParam = searchParams.get("mp_connected");
    const mpCode = searchParams.get("mp_code");
    if (code && mpConnectedParam === "true") {
      handleMPOAuthCallback(code);
    } else if (mpCode) {
      handleMPOAuthCallback(mpCode);
    }
  }, [searchParams]);

  const loadMpConfig = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-mp-config");
      if (error) throw error;
      if (data?.app_id) setMpAppId(data.app_id);
    } catch (err) {
      console.error("Error loading MP config:", err);
    }
  };

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payment_policies")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPolicyId(data.id);
        setPolicyType((data.policy_type as PolicyType) || "none");
        setMpConnected(!!data.mp_access_token);

        if (data.deposit_percentage !== null && data.deposit_percentage < 100) {
          setChargeType("deposit");
          setDepositPercentage(data.deposit_percentage);
        } else {
          setChargeType("full");
          setDepositPercentage(50);
        }
      }

      const { data: biz } = await supabase
        .from("businesses")
        .select("default_session_price")
        .eq("id", businessId)
        .maybeSingle();
      setSessionPrice(Number((biz as any)?.default_session_price) || 0);
    } catch (err) {
      console.error("Error loading payment policy:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMPOAuthCallback = async (code: string) => {
    try {
      setProcessingOAuth(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke("connect-mercadopago", {
        body: { code, business_id: businessId },
      });

      if (error) throw error;

      toast({ title: "¡Mercado Pago conectado!", description: "Ya podés configurar los cobros online." });
      setMpConnected(true);
      // Clean URL params
      searchParams.delete("code");
      searchParams.delete("mp_connected");
      searchParams.delete("mp_code");
      searchParams.delete("tab");
      setSearchParams(searchParams, { replace: true });
      await loadPolicy();
    } catch (err) {
      console.error("MP OAuth error:", err);
      toast({ title: "Error", description: "No se pudo conectar Mercado Pago. Intentá de nuevo.", variant: "destructive" });
    } finally {
      setProcessingOAuth(false);
    }
  };

  const handleConnectMP = () => {
    if (!mpAppId) {
      toast({ title: "Error", description: "No se pudo obtener la configuración de Mercado Pago.", variant: "destructive" });
      return;
    }
    const url = `https://auth.mercadopago.com/authorization?client_id=${mpAppId}&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}&state=${businessId}`;
    window.open(url, "_blank");
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      // Sin Mercado Pago no puede quedar activa una política que cobra online:
      // se vuelve a "Sin pago previo" para que la config nunca mienta.
      const resetPolicy = policyType !== "none";
      const { error } = await supabase
        .from("payment_policies")
        .update({
          mp_access_token: null,
          mp_public_key: null,
          ...(resetPolicy ? { policy_type: "none", deposit_percentage: null } : {}),
        })
        .eq("business_id", businessId);

      if (error) throw error;
      setMpConnected(false);
      if (resetPolicy) {
        setPolicyType("none");
        toast({
          title: "Mercado Pago desconectado",
          description: "Tu política de cobro volvió a 'Sin pago previo' porque el cobro online necesita Mercado Pago.",
        });
      } else {
        toast({ title: "Mercado Pago desconectado" });
      }
    } catch (err) {
      console.error("Disconnect error:", err);
      toast({ title: "Error", description: "No se pudo desconectar", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSave = async () => {
    // Guarda: sin Mercado Pago conectado no se puede guardar una política
    // que promete cobrar online (silenciosamente no cobraría nada).
    if (policyType !== "none" && !mpConnected) {
      toast({
        title: "Conectá Mercado Pago primero",
        description: "Para cobrar online al reservar necesitás tu cuenta de Mercado Pago conectada.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);

      const depositPct = policyType === "required"
        ? (chargeType === "full" ? 100 : depositPercentage)
        : null;

      const payload = {
        business_id: businessId,
        policy_type: policyType,
        deposit_percentage: depositPct,
      };

      const { error } = await supabase
        .from("payment_policies")
        .upsert(payload, { onConflict: "business_id" });

      if (error) throw error;

      toast({ title: "Guardado", description: "La política de cobro se actualizó correctamente." });
      await loadPolicy();
    } catch (err) {
      console.error("Save error:", err);
      toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (processingOAuth) {
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Conectando con Mercado Pago...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    // Desktop: política de cobro protagonista (izquierda) + conexión MP al costado
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
      <div className="order-1 lg:order-2 lg:col-span-2">
      {/* 1. Conectar Mercado Pago */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Mercado Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mpConnected ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Mercado Pago conectado
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="gap-2 text-destructive hover:text-destructive"
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conectá tu cuenta de Mercado Pago para recibir pagos de sesiones directamente.
              </p>
              <Button onClick={handleConnectMP} disabled={!mpAppId} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Conectar con Mercado Pago
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      </div>

      <div className="order-2 lg:order-1 lg:col-span-3 space-y-5">
      {/* 2. Política de cobro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Política de cobro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Config inconsistente (ej: MP desconectado desde otro lado con una
              política de cobro activa): avisar fuerte, porque las reservas
              estarían entrando SIN cobrar. */}
          {!mpConnected && policyType !== "none" && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <p className="font-semibold">Tu política de cobro no puede funcionar</p>
              <p className="text-xs mt-1">
                Está configurado el cobro online pero Mercado Pago no está conectado, así que las
                reservas entran <span className="font-semibold">sin pagar</span>. Conectá Mercado Pago
                arriba, o cambiá a "Sin pago previo" y guardá.
              </p>
            </div>
          )}
          <div className="space-y-3">
            {([
              { value: "none" as PolicyType, label: "Sin pago previo", desc: "El paciente reserva sin pagar. Cobrás en la sesión.", needsMp: false },
              { value: "optional" as PolicyType, label: "Pago opcional al reservar", desc: "El paciente puede pagar online o en la sesión.", needsMp: true },
              { value: "required" as PolicyType, label: "Pago requerido para confirmar", desc: "La reserva se confirma solo cuando el paciente paga.", needsMp: true },
            ]).map((opt) => {
              const disabled = opt.needsMp && !mpConnected;
              return (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                    disabled
                      ? "border-border/50 opacity-55 cursor-not-allowed"
                      : policyType === opt.value
                      ? "border-primary bg-primary/5 cursor-pointer"
                      : "border-border hover:bg-muted/50 cursor-pointer"
                  }`}
                >
                  <input
                    type="radio"
                    name="policyType"
                    value={opt.value}
                    checked={policyType === opt.value}
                    disabled={disabled}
                    onChange={() => {
                      if (disabled) {
                        toast({
                          title: "Conectá Mercado Pago primero",
                          description: "Esta opción cobra online: necesita tu cuenta de Mercado Pago conectada.",
                        });
                        return;
                      }
                      setPolicyType(opt.value);
                    }}
                    className="mt-0.5 accent-[hsl(var(--primary))]"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium inline-flex items-center gap-2 flex-wrap">
                      {opt.label}
                      {disabled && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          Requiere Mercado Pago
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Deposit config - only when required */}
          {policyType === "required" && (
            <div className="space-y-4 pt-2 border-t">
              <p className="text-sm font-medium">¿Cobrar el total o una seña?</p>
              <div className="space-y-3">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    chargeType === "full" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="chargeType"
                    value="full"
                    checked={chargeType === "full"}
                    onChange={() => setChargeType("full")}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span className="text-sm">100% del precio</span>
                </label>

                <label
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    chargeType === "deposit" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="chargeType"
                    value="deposit"
                    checked={chargeType === "deposit"}
                    onChange={() => setChargeType("deposit")}
                    className="mt-0.5 accent-[hsl(var(--primary))]"
                  />
                  <div className="flex-1">
                    <span className="text-sm">Seña (porcentaje)</span>
                    {chargeType === "deposit" && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Porcentaje de seña</span>
                          <span className="text-sm font-semibold tabular-nums">{depositPercentage}%</span>
                        </div>
                        <Slider
                          value={[depositPercentage]}
                          onValueChange={([v]) => setDepositPercentage(v)}
                          min={10}
                          max={90}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>10%</span>
                          <span>90%</span>
                        </div>
                        {sessionPrice > 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">
                            Con tu tarifa actual (${sessionPrice} UYU), el paciente pagaría{" "}
                            <span className="font-semibold">${Math.round(sessionPrice * depositPercentage / 100)} UYU</span> de seña.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            Definí tu tarifa por sesión en la pestaña <span className="font-medium">General</span> para
                            ver cuánto pagaría el paciente.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Guardando..." : "Guardar política de cobro"}
        </Button>
      </div>
      </div>
    </div>
  );
};
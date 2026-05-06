import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

type PolicyType = "none" | "optional" | "required";

interface PaymentPolicy {
  id?: string;
  business_id: string;
  policy_type: PolicyType;
  deposit_percentage: number | null;
  session_price: number;
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
        setSessionPrice(data.session_price || 0);
        setMpConnected(!!data.mp_access_token);

        if (data.deposit_percentage !== null && data.deposit_percentage < 100) {
          setChargeType("deposit");
          setDepositPercentage(data.deposit_percentage);
        } else {
          setChargeType("full");
          setDepositPercentage(50);
        }
      }
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
      const { error } = await supabase
        .from("payment_policies")
        .update({ mp_access_token: null, mp_public_key: null })
        .eq("business_id", businessId);

      if (error) throw error;
      setMpConnected(false);
      toast({ title: "Mercado Pago desconectado" });
    } catch (err) {
      console.error("Disconnect error:", err);
      toast({ title: "Error", description: "No se pudo desconectar", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const depositPct = policyType === "required"
        ? (chargeType === "full" ? 100 : depositPercentage)
        : null;

      const payload = {
        business_id: businessId,
        policy_type: policyType,
        session_price: sessionPrice,
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
    <div className="space-y-5">
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

      {/* 2. Precio de sesión */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Precio de la sesión
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="sessionPrice">Precio en UYU</Label>
            <Input
              id="sessionPrice"
              type="number"
              min={0}
              max={99999}
              value={sessionPrice || ""}
              onChange={(e) => setSessionPrice(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="Ej: 1500"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              Este precio se usa como referencia para los cobros online.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. Política de cobro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Política de cobro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {([
              { value: "none" as PolicyType, label: "Sin pago previo", desc: "El paciente reserva sin pagar. Cobrás en la sesión." },
              { value: "optional" as PolicyType, label: "Pago opcional al reservar", desc: "El paciente puede pagar online o en la sesión." },
              { value: "required" as PolicyType, label: "Pago requerido para confirmar", desc: "La reserva se confirma solo cuando el paciente paga." },
            ]).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  policyType === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="policyType"
                  value={opt.value}
                  checked={policyType === opt.value}
                  onChange={() => setPolicyType(opt.value)}
                  className="mt-0.5 accent-[hsl(var(--primary))]"
                />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                </div>
              </label>
            ))}
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
                        {sessionPrice > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            El paciente pagaría <span className="font-semibold">${Math.round(sessionPrice * depositPercentage / 100)} UYU</span> de seña.
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
  );
};
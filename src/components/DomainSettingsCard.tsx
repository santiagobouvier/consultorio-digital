import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Globe,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
  Copy,
  ExternalLink,
  Info,
} from "lucide-react";
import {
  checkSubdomainAvailability,
  checkCustomDomainAvailability,
  getSubdomainUrl,
} from "@/hooks/use-hostname-business";

interface DomainSettingsCardProps {
  businessId: string;
  isOwner: boolean;
}

export const DomainSettingsCard = ({ businessId, isOwner }: DomainSettingsCardProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Web domain state
  const [customSubdomain, setCustomSubdomain] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [originalSubdomain, setOriginalSubdomain] = useState("");
  const [originalDomain, setOriginalDomain] = useState("");

  // Availability checks
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);

  useEffect(() => {
    loadDomainSettings();
  }, [businessId]);

  // Debounced subdomain check
  useEffect(() => {
    if (!customSubdomain || customSubdomain.length < 3 || customSubdomain === originalSubdomain) {
      setSubdomainAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingSubdomain(true);
      const available = await checkSubdomainAvailability(customSubdomain);
      setSubdomainAvailable(available);
      setCheckingSubdomain(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [customSubdomain, originalSubdomain]);

  // Debounced domain check
  useEffect(() => {
    if (!customDomain || customDomain === originalDomain) {
      setDomainAvailable(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingDomain(true);
      const available = await checkCustomDomainAvailability(customDomain);
      setDomainAvailable(available);
      setCheckingDomain(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [customDomain, originalDomain]);

  const loadDomainSettings = async () => {
    try {
      const { data } = await supabase
        .from("businesses")
        .select("custom_subdomain, custom_domain")
        .eq("id", businessId)
        .single();

      if (data) {
        setCustomSubdomain(data.custom_subdomain || "");
        setCustomDomain(data.custom_domain || "");
        setOriginalSubdomain(data.custom_subdomain || "");
        setOriginalDomain(data.custom_domain || "");
      }
    } catch (error) {
      console.error("Error loading domain settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWebDomain = async () => {
    if (subdomainAvailable === false) {
      toast({ title: "Error", description: "El subdominio no está disponible", variant: "destructive" });
      return;
    }
    if (customDomain && domainAvailable === false) {
      toast({ title: "Error", description: "El dominio no está disponible", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("businesses")
        .update({
          custom_subdomain: customSubdomain || null,
          custom_domain: customDomain || null,
        })
        .eq("id", businessId);

      if (error) throw error;

      setOriginalSubdomain(customSubdomain);
      setOriginalDomain(customDomain);
      setSubdomainAvailable(null);
      setDomainAvailable(null);

      toast({ title: "Éxito", description: "Configuración de dominio guardada correctamente" });
    } catch (error) {
      console.error("Error saving domain:", error);
      toast({ title: "Error", description: "No se pudo guardar la configuración", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada", description: "Se copió al portapapeles" });
  };

  const hasWebChanges =
    customSubdomain !== originalSubdomain || customDomain !== originalDomain;

  if (loading) {
    return (
      <Card className="mobile-card">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Web Domain Card */}
      <Card className="mobile-card">
        <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Dominio del sitio web
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Configurá la dirección web donde tus pacientes acceden a tu consultorio
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-5">
          {/* Subdomain */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Subdominio gratuito</Label>
            <div className="flex items-center gap-2">
              <Input
                value={customSubdomain}
                onChange={(e) =>
                  setCustomSubdomain(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "")
                      .slice(0, 30)
                  )
                }
                placeholder="mi-consultorio"
                className="max-w-[200px] h-11 rounded-xl"
                disabled={!isOwner}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                .consultoriodigital.app
              </span>
              {checkingSubdomain && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {!checkingSubdomain && subdomainAvailable === true && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              {!checkingSubdomain && subdomainAvailable === false && (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
            </div>
            {customSubdomain && customSubdomain.length >= 3 && customSubdomain !== originalSubdomain && (
              <div className="mt-1">
                {subdomainAvailable === true && (
                  <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 text-xs">
                    ✓ Disponible
                  </Badge>
                )}
                {subdomainAvailable === false && (
                  <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 text-xs">
                    ✗ No disponible
                  </Badge>
                )}
              </div>
            )}
            {originalSubdomain && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  value={getSubdomainUrl(originalSubdomain)}
                  readOnly
                  className="font-mono text-xs h-9 rounded-lg flex-1 bg-muted/30"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => copyUrl(getSubdomainUrl(originalSubdomain))}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => window.open(getSubdomainUrl(originalSubdomain), "_blank")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Custom Domain */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Dominio propio (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value.toLowerCase().trim())}
                placeholder="consultoriojuan.com"
                className="flex-1 h-11 rounded-xl"
                disabled={!isOwner}
              />
              {checkingDomain && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {!checkingDomain && domainAvailable === true && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              {!checkingDomain && domainAvailable === false && (
                <AlertCircle className="w-5 h-5 text-destructive" />
              )}
            </div>
            {customDomain && customDomain !== originalDomain && domainAvailable === true && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                ⏳ Pendiente DNS — Configurar después de guardar
              </Badge>
            )}
            <p className="text-xs text-muted-foreground">
              Podés usar tu dominio propio (ej: consultoriojuan.com) o un subdominio (ej: consultorio.midominio.com)
            </p>
          </div>

          {/* DNS Instructions (show when custom domain is set) */}
          {originalDomain && (
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-amber-800">Configuración DNS requerida</p>
                  <p className="text-xs text-amber-700">
                    Para que tu dominio <strong>{originalDomain}</strong> funcione, configurá estos registros en tu proveedor de DNS:
                  </p>
                  <div className="bg-background rounded-lg p-2 space-y-1 text-xs font-mono">
                    <p><span className="text-muted-foreground">Tipo:</span> CNAME</p>
                    <p><span className="text-muted-foreground">Nombre:</span> {originalDomain.includes(".") && !originalDomain.startsWith("www") ? originalDomain.split(".")[0] : "@"}</p>
                    <p><span className="text-muted-foreground">Valor:</span> consultoriodigital.app</p>
                  </div>
                  <p className="text-xs text-amber-600">
                    La propagación DNS puede tardar hasta 48 horas.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          {isOwner && hasWebChanges && (
            <Button
              onClick={handleSaveWebDomain}
              disabled={saving || subdomainAvailable === false || (!!customDomain && domainAvailable === false)}
              className="w-full h-11 rounded-xl font-semibold"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Guardar dominio"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Email Domain Card */}
      <Card className="mobile-card">
        <CardHeader className="px-0 pt-0 pb-4 sm:px-6 sm:pt-6">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Dominio de email
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Configurá tu dominio para enviar recordatorios y notificaciones desde tu propia dirección de email
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6 space-y-4">
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Emails profesionales</p>
                <p className="text-xs text-muted-foreground">
                  Enviá recordatorios automáticos y notificaciones desde una dirección como{" "}
                  <strong>noreply@tudominio.com</strong> en lugar de una dirección genérica.
                  Esto mejora la entregabilidad y refuerza tu marca.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Beneficios</h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Mayor entregabilidad — menos emails en spam
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Marca profesional en cada comunicación
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  Confianza del paciente al ver tu dominio
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-3">
                Para configurar el envío de emails desde tu dominio, necesitás agregar registros DNS. 
                El proceso es guiado y toma solo unos minutos.
              </p>
              <Badge variant="outline" className="text-muted-foreground text-xs">
                📧 Próximamente — Configuración disponible desde el panel
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

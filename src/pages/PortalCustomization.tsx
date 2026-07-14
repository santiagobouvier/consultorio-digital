import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Palette, Upload, Eye, Check, Building2,
  Sun, Moon, Type, Image as ImageIcon, Sparkles,
  Link as LinkIcon, Copy, ExternalLink, Loader2, CheckCircle2, XCircle,
} from "lucide-react";
import { HelpTooltip } from "@/components/HelpTooltip";
import { buildShareUrl } from "@/config/app";
import { PortalInviteBatch } from "@/components/PortalInviteBatch";
import { PWAIconEditor, generatePwaIconBlob } from "@/components/PWAIconEditor";
import type { Area } from "react-easy-crop";

const THEME_PRESETS = [
  { id: "teal", name: "Teal", light: "176 100% 32%", dark: "176 85% 42%", preview: "hsl(176, 100%, 32%)" },
  { id: "blue", name: "Azul", light: "220 90% 45%", dark: "220 80% 55%", preview: "hsl(220, 90%, 45%)" },
  { id: "purple", name: "Violeta", light: "270 75% 50%", dark: "270 65% 60%", preview: "hsl(270, 75%, 50%)" },
  { id: "rose", name: "Rosa", light: "340 80% 52%", dark: "340 70% 60%", preview: "hsl(340, 80%, 52%)" },
  { id: "amber", name: "Ámbar", light: "38 92% 40%", dark: "38 80% 50%", preview: "hsl(38, 92%, 40%)" },
  { id: "emerald", name: "Esmeralda", light: "152 76% 32%", dark: "152 65% 42%", preview: "hsl(152, 76%, 32%)" },
  { id: "slate", name: "Pizarra", light: "215 20% 35%", dark: "215 15% 55%", preview: "hsl(215, 20%, 35%)" },
  { id: "custom", name: "Personalizado", light: "", dark: "", preview: "linear-gradient(135deg, #ff6b6b, #4ecdc4, #45b7d1)" },
];

const hslToHex = (hslStr: string): string => {
  const parts = hslStr.split(" ");
  if (parts.length < 3) return "#00a89d";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

const hexToHsl = (hex: string): string => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const PortalCustomization = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { businessId, loading: bizLoading } = useBusinessId();

  const [clinicName, setClinicName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("teal");
  const [lightColor, setLightColor] = useState("176 100% 32%");
  const [darkColor, setDarkColor] = useState("176 85% 42%");
  const [customLightHex, setCustomLightHex] = useState("#00a89d");
  const [customDarkHex, setCustomDarkHex] = useState("#00bfb3");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [initialSlug, setInitialSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [copied, setCopied] = useState(false);

  // PWA icon editor
  const [iconBgColor, setIconBgColor] = useState<string>("#00a89d");
  const [pendingIcon, setPendingIcon] = useState<{ sourceImage: string; crop: Area; bgColor: string } | null>(null);

  useEffect(() => {
    if (!businessId) return;
    const load = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("name, public_slug, portal_clinic_display_name, portal_logo_url, portal_primary_color, portal_dark_primary_color, portal_theme_preset")
        .eq("id", businessId)
        .single();
      if (data) {
        setClinicName((data as any).portal_clinic_display_name || data.name || "");
        setLogoUrl((data as any).portal_logo_url || "");
        const preset = (data as any).portal_theme_preset || "teal";
        setSelectedPreset(preset);
        const lc = (data as any).portal_primary_color || "176 100% 32%";
        const dc = (data as any).portal_dark_primary_color || "176 85% 42%";
        setLightColor(lc);
        setDarkColor(dc);
        setCustomLightHex(hslToHex(lc));
        setCustomDarkHex(hslToHex(dc));
        setPublicSlug((data as any).public_slug || "");
        setInitialSlug((data as any).public_slug || "");
        // Inicializar color de fondo del ícono con el color primario del consultorio
        setIconBgColor(hslToHex(lc));
      }
    };
    load();
  }, [businessId]);

  // Validar slug con debounce
  useEffect(() => {
    if (!businessId) return;
    if (publicSlug === initialSlug) {
      setSlugStatus("idle");
      return;
    }
    if (!/^[a-z0-9-]{3,}$/.test(publicSlug)) {
      setSlugStatus("invalid");
      return;
    }
    setSlugStatus("checking");
    const handle = setTimeout(async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id")
        .eq("public_slug", publicSlug)
        .neq("id", businessId)
        .maybeSingle();
      if (error) {
        setSlugStatus("idle");
        return;
      }
      setSlugStatus(data ? "taken" : "available");
    }, 450);
    return () => clearTimeout(handle);
  }, [publicSlug, initialSlug, businessId]);

  const portalUrl = publicSlug ? buildShareUrl(`/portal/${publicSlug}`) : "";

  const copyPortalUrl = async () => {
    if (!portalUrl) return;
    await navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast({ title: "URL copiada" });
    setTimeout(() => setCopied(false), 2000);
  };

  const openPortal = () => {
    if (portalUrl) window.open(portalUrl, "_blank");
  };

  const handlePresetSelect = (preset: typeof THEME_PRESETS[0]) => {
    setSelectedPreset(preset.id);
    if (preset.id !== "custom") {
      setLightColor(preset.light);
      setDarkColor(preset.dark);
      setCustomLightHex(hslToHex(preset.light));
      setCustomDarkHex(hslToHex(preset.dark));
    }
  };

  const handleCustomLightChange = (hex: string) => {
    setCustomLightHex(hex);
    setLightColor(hexToHsl(hex));
    setSelectedPreset("custom");
  };

  const handleCustomDarkChange = (hex: string) => {
    setCustomDarkHex(hex);
    setDarkColor(hexToHsl(hex));
    setSelectedPreset("custom");
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      let nextLogoUrl = logoUrl;

      // Si hay un ícono pendiente, generarlo y subirlo
      if (pendingIcon) {
        const blob = await generatePwaIconBlob(
          pendingIcon.sourceImage,
          pendingIcon.crop,
          pendingIcon.bgColor,
          512
        );
        const path = `portal-logos/${businessId}-icon.png`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: "image/png", cacheControl: "3600" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        // Cache-bust para forzar refresh de manifest/imagen
        nextLogoUrl = `${urlData.publicUrl}?v=${Date.now()}`;
        setLogoUrl(nextLogoUrl);
        setPendingIcon(null);
      }

      const update: Record<string, any> = {
        portal_clinic_display_name: clinicName,
        portal_logo_url: nextLogoUrl,
        portal_primary_color: lightColor,
        portal_dark_primary_color: darkColor,
        portal_theme_preset: selectedPreset,
      };
      // Validar y persistir cambio de slug
      if (publicSlug !== initialSlug) {
        if (!/^[a-z0-9-]{3,}$/.test(publicSlug)) {
          toast({ title: "Slug inválido", description: "Usá solo letras minúsculas, números y guiones (mín. 3).", variant: "destructive" });
          setSaving(false);
          return;
        }
        const { data: clash } = await supabase
          .from("businesses")
          .select("id")
          .eq("public_slug", publicSlug)
          .neq("id", businessId)
          .maybeSingle();
        if (clash) {
          toast({ title: "Slug no disponible", description: "Ese slug ya está siendo usado por otro consultorio.", variant: "destructive" });
          setSlugStatus("taken");
          setSaving(false);
          return;
        }
        update.public_slug = publicSlug;
      }
      const { error } = await supabase
        .from("businesses")
        .update(update as any)
        .eq("id", businessId);
      if (error) throw error;
      if (publicSlug !== initialSlug) {
        setInitialSlug(publicSlug);
        setSlugStatus("idle");
      }
      toast({ title: "Personalización guardada", description: "Los cambios se reflejarán en el portal del paciente." });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const PortalPreview = ({ mode, primaryColor, bgColor, cardBg, textColor, subtextColor, borderColor }: {
    mode: "light" | "dark";
    primaryColor: string;
    bgColor: string;
    cardBg: string;
    textColor: string;
    subtextColor: string;
    borderColor: string;
  }) => (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: bgColor, borderColor }}>
      <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ backgroundColor: cardBg, borderColor }}>
        {mode === "light" ? <Sun className="h-3.5 w-3.5" style={{ color: subtextColor }} /> : <Moon className="h-3.5 w-3.5" style={{ color: subtextColor }} />}
        <span className="text-xs font-medium" style={{ color: subtextColor }}>
          {mode === "light" ? "Modo claro" : "Modo oscuro"}
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} className="h-9 w-9 rounded-lg object-cover" alt="" />
          ) : (
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(${primaryColor} / 0.12)` }}>
              <Building2 className="h-4 w-4" style={{ color: `hsl(${primaryColor})` }} />
            </div>
          )}
          <div>
            <p className="font-bold text-xs" style={{ color: textColor }}>{clinicName || "Mi Portal"}</p>
            <p className="text-[10px]" style={{ color: subtextColor }}>Portal del paciente</p>
          </div>
        </div>
        <div className="flex gap-2">
          {["Resumen", "Citas", "Pagos"].map((t, i) => (
            <div key={t} className="px-2.5 py-1 rounded-md text-[10px] font-medium"
              style={i === 0 ? { backgroundColor: `hsl(${primaryColor} / ${mode === "light" ? "0.1" : "0.15"})`, color: `hsl(${primaryColor})` } : { color: subtextColor }}
            >{t}</div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {["2", "4", "1"].map((v, i) => (
            <div key={i} className="rounded-md p-2 text-center" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg }}>
              <p className="text-sm font-bold" style={{ color: `hsl(${primaryColor})` }}>{v}</p>
              <p className="text-[9px]" style={{ color: subtextColor }}>{["Citas", "Sesiones", "Pagos"][i]}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg p-3 space-y-1.5" style={{ border: `1px solid ${borderColor}`, backgroundColor: cardBg }}>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold" style={{ color: textColor }}>Próxima cita</p>
            <div className="px-1.5 py-0.5 rounded text-[8px] font-medium" style={{ backgroundColor: `hsl(${primaryColor} / 0.15)`, color: `hsl(${primaryColor})` }}>Confirmada</div>
          </div>
          <p className="text-[9px]" style={{ color: subtextColor }}>Lunes 14 de abril — 10:00 hs</p>
        </div>
        <div className="rounded-md py-2 text-center text-[10px] font-semibold" style={{ backgroundColor: `hsl(${primaryColor})`, color: "white" }}>
          Ver todas las citas
        </div>
      </div>
    </div>
  );

  if (bizLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Cargando...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg lg:text-xl font-bold flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Personalizar Portal
                <HelpTooltip id="patientPortal" />
              </h1>
              <p className="text-xs text-muted-foreground">Configurá cómo ven los pacientes su portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
        {/* URL del portal — vive acá porque es 100% portal del paciente */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" /> Tu dirección en internet
            </CardTitle>
            <CardDescription>
              El identificador define las DOS direcciones de tu consultorio: la web pública de reservas y el portal de pacientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="publicSlug">Identificador (slug)</Label>
              <div className="flex flex-col sm:flex-row sm:items-stretch gap-2">
                <div className="flex items-center px-3 rounded-md border bg-muted/40 text-xs font-mono text-muted-foreground whitespace-nowrap h-11">
                  consultoriodigital.app/portal/
                </div>
                <div className="relative flex-1">
                  <Input
                    id="publicSlug"
                    value={publicSlug}
                    onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                    placeholder="mi-consultorio"
                    className="h-11 font-mono text-sm pr-10"
                    minLength={3}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {slugStatus === "checking" && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />}
                    {slugStatus === "available" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    {(slugStatus === "taken" || slugStatus === "invalid") && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Solo letras minúsculas, números y guiones. Mínimo 3 caracteres.
              </p>
              {slugStatus === "invalid" && (
                <p className="text-xs text-destructive">Formato inválido. Usá solo letras minúsculas, números y guiones.</p>
              )}
              {slugStatus === "taken" && (
                <p className="text-xs text-destructive">Ese slug ya está en uso por otro consultorio.</p>
              )}
              {slugStatus === "available" && (
                <p className="text-xs text-primary">Disponible. Recordá guardar para aplicar el cambio.</p>
              )}
              {slugStatus === "checking" && (
                <p className="text-xs text-muted-foreground">Verificando disponibilidad...</p>
              )}
              {publicSlug !== initialSlug && (slugStatus === "available" || slugStatus === "checking") && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Al cambiar el identificador, <strong>los links que ya compartiste dejan de funcionar</strong> (la
                  web de reservas y el portal). Vas a tener que volver a compartir los nuevos con tus pacientes.
                </div>
              )}
            </div>

            {portalUrl && (
              <div className="space-y-2">
                <Label>Tus direcciones</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Web pública</span>
                    <Input
                      value={buildShareUrl(`/consultorio/${publicSlug}`)}
                      readOnly
                      className="font-mono text-xs h-10 flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Portal</span>
                    <Input value={portalUrl} readOnly className="font-mono text-xs h-10 flex-1" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={copyPortalUrl} className="h-10 gap-2 flex-1 sm:flex-initial">
                    {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copiada" : "Copiar link del portal"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={openPortal} className="h-10 gap-2 flex-1 sm:flex-initial">
                    <ExternalLink className="h-4 w-4" /> Ver portal
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Ícono de la app
                <HelpTooltip id="portalLogo" />
              </CardTitle>
              <CardDescription>
                Es el ícono que verán tus pacientes al instalar el portal en el celular. Encuadrá tu logo dentro del círculo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PWAIconEditor
                iconUrl={logoUrl}
                bgColor={iconBgColor}
                onBgColorChange={setIconBgColor}
                suggestedBgColor={customLightHex}
                onPendingChange={setPendingIcon}
                uploading={uploading}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" /> Nombre del consultorio
                <HelpTooltip id="portalDisplayName" />
              </CardTitle>
              <CardDescription>Se muestra como título principal en el portal del paciente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">Nombre visible</Label>
                <Input id="clinic-name" value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="Ej: Consultorio Dra. María López" />
                <p className="text-xs text-muted-foreground">Este nombre aparece debajo del logo en el portal</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Tema de colores
              <HelpTooltip id="portalThemeColor" />
            </CardTitle>
            <CardDescription>Elegí una paleta predefinida o personalizá los colores del portal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm mb-3 block">Paletas predefinidas</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {THEME_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      selectedPreset === preset.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-muted/50"
                    }`}
                  >
                    {selectedPreset === preset.id && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    {preset.id !== "custom" ? (
                      <div className="flex gap-1">
                        <div className="h-8 w-8 rounded-full border-2 border-card shadow-inner" style={{ background: preset.preview }} />
                        <div className="h-8 w-8 rounded-full border-2 border-card shadow-inner" style={{ background: `hsl(${preset.dark})` }} />
                      </div>
                    ) : (
                      <div className="h-8 w-16 rounded-full border-2 border-card shadow-inner" style={{ background: preset.preview }} />
                    )}
                    <span className="text-xs font-medium">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm mb-3 block">Colores personalizados</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Color primario (modo claro)</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="color" value={customLightHex} onChange={e => handleCustomLightChange(e.target.value)} className="h-12 w-12 rounded-lg border border-border cursor-pointer p-1" />
                    <div className="flex-1">
                      <Input value={customLightHex} onChange={e => handleCustomLightChange(e.target.value)} placeholder="#00a89d" className="font-mono text-sm" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Color primario (modo oscuro)</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="color" value={customDarkHex} onChange={e => handleCustomDarkChange(e.target.value)} className="h-12 w-12 rounded-lg border border-border cursor-pointer p-1" />
                    <div className="flex-1">
                      <Input value={customDarkHex} onChange={e => handleCustomDarkChange(e.target.value)} placeholder="#00bfb3" className="font-mono text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm mb-4 block">Vista previa en tiempo real</Label>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <PortalPreview
                  mode="light"
                  primaryColor={lightColor}
                  bgColor="#f8fafb"
                  cardBg="#ffffff"
                  textColor="#1a1a1a"
                  subtextColor="#888888"
                  borderColor="#e5e7eb"
                />
                <PortalPreview
                  mode="dark"
                  primaryColor={darkColor}
                  bgColor="#0f1419"
                  cardBg="#1a2028"
                  textColor="#f0f0f0"
                  subtextColor="#777777"
                  borderColor="#2a3038"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <PortalInviteBatch businessId={businessId} />

        <div className="flex justify-end gap-3 pb-8">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default PortalCustomization;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Palette, Upload, Eye, Check, Building2,
  Sun, Moon, Type, Image as ImageIcon, Sparkles
} from "lucide-react";

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

  useEffect(() => {
    if (!businessId) return;
    const load = async () => {
      const { data } = await supabase
        .from("businesses")
        .select("name, portal_clinic_display_name, portal_logo_url, portal_primary_color, portal_dark_primary_color, portal_theme_preset")
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
      }
    };
    load();
  }, [businessId]);

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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `portal-logos/${businessId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast({ title: "Logo subido correctamente" });
    } catch (err: any) {
      toast({ title: "Error al subir logo", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("businesses")
        .update({
          portal_clinic_display_name: clinicName,
          portal_logo_url: logoUrl,
          portal_primary_color: lightColor,
          portal_dark_primary_color: darkColor,
          portal_theme_preset: selectedPreset,
        } as any)
        .eq("id", businessId);
      if (error) throw error;
      toast({ title: "Personalización guardada", description: "Los cambios se reflejarán en el portal del paciente." });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (bizLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Cargando...</p></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
              </h1>
              <p className="text-xs text-muted-foreground">Configurá cómo ven los pacientes su portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/portal-paciente/demo")}>
              <Eye className="h-4 w-4" /> Vista previa
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6 lg:space-y-8">
        {/* Identity Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-primary" /> Logo del consultorio
              </CardTitle>
              <CardDescription>Aparece en el portal y en las comunicaciones con pacientes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 rounded-xl border-2 border-dashed border-border">
                  {logoUrl ? (
                    <AvatarImage src={logoUrl} className="object-cover rounded-xl" />
                  ) : (
                    <AvatarFallback className="rounded-xl bg-primary/10">
                      <Building2 className="h-8 w-8 text-primary" />
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="space-y-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <span>
                        <Upload className="h-4 w-4" />
                        {uploading ? "Subiendo..." : "Subir logo"}
                      </span>
                    </Button>
                  </label>
                  <p className="text-xs text-muted-foreground">PNG, JPG o SVG. Máx 2MB.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clinic name */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" /> Nombre del consultorio
              </CardTitle>
              <CardDescription>Se muestra como título principal en el portal del paciente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clinic-name">Nombre visible</Label>
                <Input
                  id="clinic-name"
                  value={clinicName}
                  onChange={e => setClinicName(e.target.value)}
                  placeholder="Ej: Consultorio Dra. María López"
                />
                <p className="text-xs text-muted-foreground">Este nombre aparece debajo del logo en el portal</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Color Theme Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Tema de colores
            </CardTitle>
            <CardDescription>Elegí una paleta predefinida o personalizá los colores del portal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preset grid */}
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
                    <div
                      className="h-10 w-10 rounded-full border-2 border-card shadow-inner"
                      style={{
                        background: preset.id === "custom" ? preset.preview : preset.preview,
                      }}
                    />
                    <span className="text-xs font-medium">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Custom color pickers */}
            <div>
              <Label className="text-sm mb-3 block">Colores personalizados</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Color primario (modo claro)</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={customLightHex}
                      onChange={e => handleCustomLightChange(e.target.value)}
                      className="h-12 w-12 rounded-lg border border-border cursor-pointer p-1"
                    />
                    <div className="flex-1">
                      <Input
                        value={customLightHex}
                        onChange={e => handleCustomLightChange(e.target.value)}
                        placeholder="#00a89d"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">HSL: {lightColor}</p>
                    </div>
                  </div>
                  {/* Preview bar */}
                  <div className="rounded-lg p-4 border" style={{ backgroundColor: `hsl(${lightColor})` }}>
                    <p className="text-sm font-semibold" style={{ color: "white" }}>Vista previa modo claro</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Color primario (modo oscuro)</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={customDarkHex}
                      onChange={e => handleCustomDarkChange(e.target.value)}
                      className="h-12 w-12 rounded-lg border border-border cursor-pointer p-1"
                    />
                    <div className="flex-1">
                      <Input
                        value={customDarkHex}
                        onChange={e => handleCustomDarkChange(e.target.value)}
                        placeholder="#00bfb3"
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground mt-1">HSL: {darkColor}</p>
                    </div>
                  </div>
                  <div className="rounded-lg p-4 border" style={{ backgroundColor: `hsl(${darkColor})` }}>
                    <p className="text-sm font-semibold" style={{ color: "white" }}>Vista previa modo oscuro</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Vista previa del portal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border overflow-hidden">
              {/* Simulated portal header */}
              <div className="p-4 border-b" style={{ backgroundColor: `hsl(${lightColor} / 0.05)` }}>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img src={logoUrl} className="h-10 w-10 rounded-lg object-cover" alt="Logo" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `hsl(${lightColor} / 0.15)` }}>
                      <Building2 className="h-5 w-5" style={{ color: `hsl(${lightColor})` }} />
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-sm">{clinicName || "Mi Portal"}</p>
                    <p className="text-xs text-muted-foreground">Portal del paciente</p>
                  </div>
                </div>
              </div>
              {/* Simulated content */}
              <div className="p-4 space-y-3 bg-background">
                <div className="flex gap-3">
                  {["Resumen", "Citas", "Pagos"].map((t, i) => (
                    <div
                      key={t}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={i === 0 ? {
                        backgroundColor: `hsl(${lightColor} / 0.1)`,
                        color: `hsl(${lightColor})`,
                      } : {
                        color: "hsl(var(--muted-foreground))",
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Próximas citas", value: "2" },
                    { label: "Sesiones", value: "4" },
                    { label: "Pagos pend.", value: "1" },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg border p-3 text-center">
                      <p className="text-lg font-bold" style={{ color: `hsl(${lightColor})` }}>{item.value}</p>
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save button (bottom) */}
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

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Building2 } from "lucide-react";

const TIMEZONES = [
  { value: "America/Montevideo", label: "Uruguay (GMT-3)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (GMT-3)" },
  { value: "America/Santiago", label: "Chile (GMT-4)" },
  { value: "America/Bogota", label: "Colombia (GMT-5)" },
  { value: "America/Mexico_City", label: "México (GMT-6)" },
  { value: "Europe/Madrid", label: "España (GMT+1)" },
];

const MODALITIES = [
  { value: "presencial", label: "Presencial" },
  { value: "online", label: "Online" },
  { value: "mixto", label: "Mixto (presencial y online)" },
];

interface OnboardingData {
  // Step 1
  clinicName: string;
  specialty: string;
  city: string;
  // Step 2
  welcomeMessage: string;
  professionalDescription: string;
  contactPhone: string;
  // Step 3
  modality: string;
  timezone: string;
  workingHours: string;
}

const ConsultorioOnboarding = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [publicSlug, setPublicSlug] = useState<string>("");
  
  const [data, setData] = useState<OnboardingData>({
    clinicName: "",
    specialty: "",
    city: "",
    welcomeMessage: "",
    professionalDescription: "",
    contactPhone: "",
    modality: "mixto",
    timezone: "America/Montevideo",
    workingHours: "Lunes a viernes, 9:00 a 18:00",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    setUserId(user.id);

    // Check if user is super_admin - redirect to SaaS panel
    const { data: superAdminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (superAdminRole) {
      navigate("/saas-admin");
      return;
    }

    // Check if user is a patient
    const { data: patientRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "patient")
      .maybeSingle();

    if (patientRole) {
      navigate("/portal-paciente");
      return;
    }

    // Get business
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, specialty, timezone, public_slug, onboarding_completed")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!business) {
      navigate("/configurar-negocio");
      return;
    }

    // If onboarding already completed, go to dashboard
    if (business.onboarding_completed) {
      navigate("/dashboard");
      return;
    }

    setBusinessId(business.id);
    setPublicSlug(business.public_slug);

    // Pre-fill with existing data
    setData(prev => ({
      ...prev,
      clinicName: business.name || "",
      specialty: business.specialty || "",
      timezone: business.timezone || "America/Montevideo",
    }));

    // Get existing clinic_settings if any
    const { data: clinicSettings } = await supabase
      .from("clinic_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (clinicSettings) {
      setData(prev => ({
        ...prev,
        clinicName: clinicSettings.clinic_name || prev.clinicName,
        specialty: clinicSettings.specialty || prev.specialty,
        welcomeMessage: clinicSettings.welcome_message || "",
      }));
    }

    setLoading(false);
  };

  const updateField = (field: keyof OnboardingData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (currentStep === 1 && !data.clinicName.trim()) {
      toast.error("El nombre del consultorio es obligatorio");
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleFinish = async () => {
    if (!businessId || !userId) return;

    setSaving(true);
    try {
      // Update businesses table
      const { error: businessError } = await supabase
        .from("businesses")
        .update({
          name: data.clinicName,
          specialty: data.specialty || null,
          timezone: data.timezone,
          onboarding_completed: true,
        })
        .eq("id", businessId);

      if (businessError) throw businessError;

      // Upsert clinic_settings
      const { error: settingsError } = await supabase
        .from("clinic_settings")
        .upsert({
          user_id: userId,
          clinic_name: data.clinicName,
          specialty: data.specialty || null,
          welcome_message: data.welcomeMessage || null,
        }, {
          onConflict: "user_id",
        });

      if (settingsError) throw settingsError;

      toast.success("¡Consultorio configurado correctamente!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error saving onboarding:", error);
      toast.error("Error al guardar los datos");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Configurar mi consultorio</h1>
          <p className="text-muted-foreground text-sm">
            Te pedimos estos datos solo una vez para dejar tu consultorio listo.
            <br />Después podés cambiarlos desde la configuración.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                step === currentStep
                  ? "bg-primary text-primary-foreground"
                  : step < currentStep
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step < currentStep ? <Check className="w-4 h-4" /> : step}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {currentStep === 1 && "Datos básicos"}
              {currentStep === 2 && "Información para pacientes"}
              {currentStep === 3 && "Preferencias"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Cómo se llama tu consultorio y a qué te dedicás"}
              {currentStep === 2 && "Lo que verán tus pacientes en el portal público"}
              {currentStep === 3 && "Configuración general de tu práctica"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1 */}
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Nombre del consultorio *</Label>
                  <Input
                    id="clinicName"
                    value={data.clinicName}
                    onChange={(e) => updateField("clinicName", e.target.value)}
                    placeholder="Ej: Consultorio Dra. García"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Input
                    id="specialty"
                    value={data.specialty}
                    onChange={(e) => updateField("specialty", e.target.value)}
                    placeholder="Ej: Psicología clínica, Coaching, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad / País (opcional)</Label>
                  <Input
                    id="city"
                    value={data.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="Ej: Montevideo, Uruguay"
                  />
                </div>
              </>
            )}

            {/* Step 2 */}
            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="welcomeMessage">Mensaje de bienvenida</Label>
                  <Textarea
                    id="welcomeMessage"
                    value={data.welcomeMessage}
                    onChange={(e) => updateField("welcomeMessage", e.target.value)}
                    placeholder="Ej: Bienvenido/a a mi consultorio. Estoy aquí para acompañarte..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Este texto aparecerá en tu portal público
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="professionalDescription">Descripción del profesional (opcional)</Label>
                  <Textarea
                    id="professionalDescription"
                    value={data.professionalDescription}
                    onChange={(e) => updateField("professionalDescription", e.target.value)}
                    placeholder="Ej: Psicóloga con 10 años de experiencia..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">WhatsApp de contacto (opcional)</Label>
                  <Input
                    id="contactPhone"
                    value={data.contactPhone}
                    onChange={(e) => updateField("contactPhone", e.target.value)}
                    placeholder="Ej: +598 99 123 456"
                  />
                </div>
                {publicSlug && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Tu link público:</p>
                    <p className="text-sm font-mono break-all">
                      {window.location.origin}/clinica/{publicSlug}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Step 3 */}
            {currentStep === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Modalidad principal</Label>
                  <Select
                    value={data.modality}
                    onValueChange={(value) => updateField("modality", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALITIES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Zona horaria</Label>
                  <Select
                    value={data.timezone}
                    onValueChange={(value) => updateField("timezone", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workingHours">Horario habitual de atención</Label>
                  <Input
                    id="workingHours"
                    value={data.workingHours}
                    onChange={(e) => updateField("workingHours", e.target.value)}
                    placeholder="Ej: Lunes a viernes, 9:00 a 18:00"
                  />
                </div>
              </>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-4">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Atrás
                </Button>
              )}
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1"
                >
                  Siguiente
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex-1"
                >
                  {saving ? "Guardando..." : "Finalizar y entrar"}
                  {!saving && <Check className="w-4 h-4 ml-2" />}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConsultorioOnboarding;

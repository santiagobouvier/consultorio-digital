import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Globe, CheckCircle2, AlertCircle, Loader2, ArrowLeft, ArrowRight, Check, Building2 } from "lucide-react";
import { checkSubdomainAvailability, checkCustomDomainAvailability, getSubdomainUrl } from "@/hooks/use-hostname-business";
import LoadingPage from "@/components/LoadingPage";

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

const TOTAL_STEPS = 4;
const MAX_PRELOADER_MS = 3000;

const businessSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  specialty: z.string().max(100).optional().or(z.literal("")),
  contact_email: z.string().email("Email inválido").max(255),
  public_slug: z.string().min(1, "El slug es obligatorio").max(50).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  custom_subdomain: z.string().min(3, "Mínimo 3 caracteres").max(30).regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  custom_domain: z.string().max(100).regex(/^$|^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, "Dominio inválido").optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  welcomeMessage: z.string().max(500).optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional().or(z.literal("")),
  modality: z.string().default("mixto"),
  timezone: z.string().default("America/Montevideo"),
});

type WizardFormData = z.infer<typeof businessSchema>;

const OnboardingWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);
  const [existingBusinessId, setExistingBusinessId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const initializationStartedRef = useRef(false);
  const wizardHasControlRef = useRef(false);

  const form = useForm<WizardFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: "", specialty: "", contact_email: "", public_slug: "",
      custom_subdomain: "", custom_domain: "", city: "",
      welcomeMessage: "", contactPhone: "", modality: "mixto",
      timezone: "America/Montevideo",
    },
  });

  const watchedSubdomain = form.watch("custom_subdomain");
  const watchedDomain = form.watch("custom_domain");

  useEffect(() => {
    if (!loading) {
      wizardHasControlRef.current = true;
    }
  }, [loading]);

  useEffect(() => {
    if (!loading) return;

    const timeoutId = window.setTimeout(() => {
      wizardHasControlRef.current = true;
      setLoading(false);
    }, MAX_PRELOADER_MS);

    return () => window.clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    if (initializationStartedRef.current) return;
    initializationStartedRef.current = true;

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (!user) {
          if (!wizardHasControlRef.current) {
            navigate("/auth", { replace: true });
          }
          return;
        }

        setUserId(user.id);

        if (!form.getValues("contact_email")) {
          form.setValue("contact_email", user.email || "", { shouldDirty: false });
        }

        const [{ data: superAdminRole }, { data: patientRole }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "super_admin").maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "patient").maybeSingle(),
        ]);

        if (cancelled) return;

        if (superAdminRole) {
          if (!wizardHasControlRef.current) {
            navigate("/saas-admin", { replace: true });
          }
          return;
        }

        if (patientRole) {
          if (!wizardHasControlRef.current) {
            navigate("/portal-paciente", { replace: true });
          }
          return;
        }

        const { data: business } = await supabase
          .from("businesses")
          .select("id, name, specialty, timezone, public_slug, custom_subdomain, custom_domain, contact_email, onboarding_completed")
          .eq("owner_user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        if (business?.onboarding_completed) {
          if (!wizardHasControlRef.current) {
            navigate("/dashboard", { replace: true });
          }
          return;
        }

        if (business) {
          setExistingBusinessId(business.id);

          if (!wizardHasControlRef.current) {
            form.reset({
              name: business.name || "",
              specialty: business.specialty || "",
              contact_email: business.contact_email || user.email || "",
              public_slug: business.public_slug || "",
              custom_subdomain: business.custom_subdomain || "",
              custom_domain: business.custom_domain || "",
              timezone: business.timezone || "America/Montevideo",
              modality: "mixto",
              city: "",
              welcomeMessage: "",
              contactPhone: "",
            });
          }

          const { data: cs } = await supabase
            .from("clinic_settings")
            .select("welcome_message")
            .eq("user_id", user.id)
            .maybeSingle();

          if (cancelled) return;

          if (cs?.welcome_message && !wizardHasControlRef.current) {
            form.setValue("welcomeMessage", cs.welcome_message, { shouldDirty: false });
          }
        }
      } catch (error) {
        console.error("Error loading onboarding:", error);
        if (!wizardHasControlRef.current) {
          toast.error("No pudimos cargar la configuración del consultorio.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [form, navigate]);

  useEffect(() => {
    if (currentStep !== 2 || !watchedSubdomain || watchedSubdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setCheckingSubdomain(true);
      const available = await checkSubdomainAvailability(watchedSubdomain);
      if (!active) return;
      setSubdomainAvailable(available);
      setCheckingSubdomain(false);
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentStep, watchedSubdomain]);

  useEffect(() => {
    if (currentStep !== 2 || !watchedDomain) {
      setDomainAvailable(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setCheckingDomain(true);
      const available = await checkCustomDomainAvailability(watchedDomain);
      if (!active) return;
      setDomainAvailable(available);
      setCheckingDomain(false);
    }, 500);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentStep, watchedDomain]);

  const handleNameChange = (value: string) => {
    const subdomain = value
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
    if (!form.getValues("custom_subdomain")) form.setValue("custom_subdomain", subdomain);
    if (!form.getValues("public_slug")) form.setValue("public_slug", subdomain);
  };

  const handleNext = async () => {
    // Validate current step fields
    if (currentStep === 1) {
      const valid = await form.trigger(["name", "specialty", "contact_email"]);
      if (!valid) return;
    }
    if (currentStep === 2) {
      const valid = await form.trigger(["custom_subdomain", "public_slug"]);
      if (!valid || subdomainAvailable === false) {
        toast.error("Verificá que el subdominio sea válido y esté disponible");
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleFinish = async () => {
    const data = form.getValues();
    if (!userId) return;
    setSaving(true);

    try {
      if (existingBusinessId) {
        // Update existing business
        const { error } = await supabase.from("businesses").update({
          name: data.name,
          specialty: data.specialty || null,
          contact_email: data.contact_email,
          public_slug: data.public_slug,
          custom_subdomain: data.custom_subdomain,
          custom_domain: data.custom_domain || null,
          timezone: data.timezone,
          onboarding_completed: true,
        }).eq("id", existingBusinessId);
        if (error) throw error;
      } else {
        // Create new business
        const { error } = await supabase.from("businesses").insert([{
          owner_user_id: userId,
          name: data.name,
          specialty: data.specialty || null,
          contact_email: data.contact_email,
          public_slug: data.public_slug,
          custom_subdomain: data.custom_subdomain,
          custom_domain: data.custom_domain || null,
          timezone: data.timezone,
          onboarding_completed: true,
        }]);
        if (error) throw error;
      }

      // Upsert clinic_settings
      await supabase.from("clinic_settings").upsert({
        user_id: userId,
        clinic_name: data.name,
        specialty: data.specialty || null,
        welcome_message: data.welcomeMessage || null,
      }, { onConflict: "user_id" });

      toast.success("¡Consultorio configurado correctamente!");
      navigate("/activar-prueba");
    } catch (error: any) {
      console.error("Error saving:", error);
      toast.error("Error al guardar los datos. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPage />;

  const stepLabels = ["Datos básicos", "Dirección web", "Info pacientes", "Preferencias"];

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
            Completá estos pasos para dejar tu consultorio listo.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
            <div key={step} className="flex items-center gap-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                  step === currentStep
                    ? "bg-primary text-primary-foreground"
                    : step < currentStep
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() => step < currentStep && setCurrentStep(step)}
              >
                {step < currentStep ? <Check className="w-4 h-4" /> : step}
              </div>
              {step < TOTAL_STEPS && <div className={`w-8 h-0.5 ${step < currentStep ? "bg-primary/30" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{stepLabels[currentStep - 1]}</CardTitle>
            <CardDescription>
              Paso {currentStep} de {TOTAL_STEPS}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Form {...form}>
              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                {/* Step 1: Basic info */}
                {currentStep === 1 && (
                  <>
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del consultorio *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Consultorio Dra. María González" onChange={(e) => { field.onChange(e); handleNameChange(e.target.value); }} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="specialty" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Especialidad</FormLabel>
                        <FormControl><Input {...field} placeholder="Psicología, Nutrición..." /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contact_email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email de contacto *</FormLabel>
                        <FormControl><Input {...field} type="email" placeholder="consultorio@example.com" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}

                {/* Step 2: Web address */}
                {currentStep === 2 && (
                  <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold">Dirección web de tu consultorio</h3>
                    </div>
                    <FormField control={form.control} name="custom_subdomain" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subdominio gratis *</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl><Input {...field} placeholder="mi-consultorio" className="max-w-[200px]" /></FormControl>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">.consultoriodigital.app</span>
                          {checkingSubdomain && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                          {!checkingSubdomain && subdomainAvailable === true && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                          {!checkingSubdomain && subdomainAvailable === false && <AlertCircle className="w-5 h-5 text-destructive" />}
                        </div>
                        {watchedSubdomain && watchedSubdomain.length >= 3 && subdomainAvailable === true && (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50 mt-2">
                            ✓ Disponible: {getSubdomainUrl(watchedSubdomain)}
                          </Badge>
                        )}
                        {watchedSubdomain && subdomainAvailable === false && (
                          <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10 mt-2">✗ No disponible</Badge>
                        )}
                        <FormDescription>Tu dirección web gratuita.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="custom_domain" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dominio propio (opcional)</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl><Input {...field} placeholder="consultoriojuan.com" className="flex-1" /></FormControl>
                          {checkingDomain && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                          {!checkingDomain && domainAvailable === true && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                          {!checkingDomain && domainAvailable === false && <AlertCircle className="w-5 h-5 text-destructive" />}
                        </div>
                        <FormDescription>Configurar después de finalizar.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="public_slug" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug público *</FormLabel>
                        <FormControl><Input {...field} placeholder="dra-maria-gonzalez" /></FormControl>
                        <FormDescription>Identificador único para URLs internas.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                {/* Step 3: Patient-facing info */}
                {currentStep === 3 && (
                  <>
                    <FormField control={form.control} name="welcomeMessage" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mensaje de bienvenida</FormLabel>
                        <FormControl><Textarea {...field} placeholder="Bienvenido/a a mi consultorio..." rows={3} /></FormControl>
                        <FormDescription>Aparecerá en tu portal público</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp de contacto (opcional)</FormLabel>
                        <FormControl><Input {...field} placeholder="+598 99 123 456" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}

                {/* Step 4: Preferences */}
                {currentStep === 4 && (
                  <>
                    <FormField control={form.control} name="modality" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modalidad principal</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="timezone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zona horaria</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            {TIMEZONES.map(tz => <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}
              </form>
            </Form>

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
              {currentStep > 1 && (
                <Button type="button" variant="outline" onClick={handleBack} className="flex-1">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
                </Button>
              )}
              {currentStep < TOTAL_STEPS ? (
                <Button type="button" onClick={handleNext} className="flex-1">
                  Siguiente <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="button" onClick={handleFinish} disabled={saving} className="flex-1">
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

export default OnboardingWizard;

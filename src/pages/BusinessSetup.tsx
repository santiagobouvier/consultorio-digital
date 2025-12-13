import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Globe, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { checkSubdomainAvailability, checkCustomDomainAvailability, getSubdomainUrl } from "@/hooks/use-hostname-business";

const businessSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  specialty: z.string().min(1, "La especialidad es obligatoria").max(100),
  contact_email: z.string().email("Email inválido").max(255),
  public_slug: z
    .string()
    .min(1, "El slug es obligatorio")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  custom_subdomain: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(30)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  custom_domain: z
    .string()
    .max(100)
    .regex(/^$|^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/, "Dominio inválido")
    .optional()
    .or(z.literal("")),
});

type BusinessFormData = z.infer<typeof businessSchema>;

const BusinessSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [domainAvailable, setDomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);
  const [checkingDomain, setCheckingDomain] = useState(false);

  const form = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: "",
      specialty: "",
      contact_email: "",
      public_slug: "",
      custom_subdomain: "",
      custom_domain: "",
    },
  });

  const watchedSubdomain = form.watch("custom_subdomain");
  const watchedDomain = form.watch("custom_domain");

  // Debounced subdomain availability check
  useEffect(() => {
    if (!watchedSubdomain || watchedSubdomain.length < 3) {
      setSubdomainAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSubdomain(true);
      const available = await checkSubdomainAvailability(watchedSubdomain);
      setSubdomainAvailable(available);
      setCheckingSubdomain(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [watchedSubdomain]);

  // Debounced domain availability check
  useEffect(() => {
    if (!watchedDomain) {
      setDomainAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDomain(true);
      const available = await checkCustomDomainAvailability(watchedDomain);
      setDomainAvailable(available);
      setCheckingDomain(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [watchedDomain]);

  // Auto-generate subdomain from name
  const handleNameChange = (value: string) => {
    const subdomain = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
    
    if (!form.getValues("custom_subdomain")) {
      form.setValue("custom_subdomain", subdomain);
    }
    
    // Also update public_slug
    if (!form.getValues("public_slug")) {
      form.setValue("public_slug", subdomain);
    }
  };

  const onSubmit = async (data: BusinessFormData) => {
    if (subdomainAvailable === false) {
      toast.error("El subdominio no está disponible");
      return;
    }

    if (data.custom_domain && domainAvailable === false) {
      toast.error("El dominio no está disponible");
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No se encontró el usuario autenticado");
        navigate("/auth");
        return;
      }

      const userId = user.id;

      const { data: existingBusiness } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", userId)
        .maybeSingle();

      if (existingBusiness) {
        toast.error("Ya tenés un consultorio configurado");
        navigate("/dashboard");
        return;
      }

      const businessData = {
        owner_user_id: userId,
        name: data.name,
        specialty: data.specialty,
        contact_email: data.contact_email,
        public_slug: data.public_slug,
        custom_subdomain: data.custom_subdomain,
        custom_domain: data.custom_domain || null,
        timezone: "America/Montevideo",
      };

      const { error } = await supabase
        .from("businesses")
        .insert([businessData]);

      if (error) throw error;

      toast.success("¡Consultorio configurado correctamente!");
      
      if (data.custom_domain) {
        toast.info("Recordá configurar los DNS de tu dominio para que funcione correctamente.", {
          duration: 8000,
        });
      }
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating business:", error);
      toast.error("No se pudo crear el consultorio. Por favor, intentá de nuevo más tarde.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Configurar mi consultorio
          </CardTitle>
          <CardDescription className="text-center">
            Completá la información básica de tu consultorio profesional
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del consultorio *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Consultorio Dra. María González"
                        onChange={(e) => {
                          field.onChange(e);
                          handleNameChange(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="specialty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Especialidad *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Psicología, Nutrición, Medicina General..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de contacto *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="consultorio@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subdomain section */}
              <div className="space-y-4 p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold">Dirección web de tu consultorio</h3>
                </div>

                <FormField
                  control={form.control}
                  name="custom_subdomain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subdominio gratis *</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="mi-consultorio"
                            className="max-w-[200px]"
                          />
                        </FormControl>
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                          .consultoriodigital.app
                        </span>
                        {checkingSubdomain && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {!checkingSubdomain && subdomainAvailable === true && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                        {!checkingSubdomain && subdomainAvailable === false && (
                          <AlertCircle className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      {watchedSubdomain && watchedSubdomain.length >= 3 && (
                        <div className="mt-2">
                          {subdomainAvailable === true && (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">
                              ✓ Disponible: {getSubdomainUrl(watchedSubdomain)}
                            </Badge>
                          )}
                          {subdomainAvailable === false && (
                            <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/10">
                              ✗ No disponible
                            </Badge>
                          )}
                        </div>
                      )}
                      <FormDescription>
                        Esta será tu dirección web gratuita para que tus pacientes agenden citas.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="custom_domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dominio propio (opcional)</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="consultoriojuan.com o consultorio.midominio.com"
                            className="flex-1"
                          />
                        </FormControl>
                        {checkingDomain && (
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        )}
                        {!checkingDomain && domainAvailable === true && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                        {!checkingDomain && domainAvailable === false && (
                          <AlertCircle className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      {watchedDomain && domainAvailable === true && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            ⏳ Pendiente DNS - Configurar después
                          </Badge>
                        </div>
                      )}
                      <FormDescription>
                        Podés usar tu propio dominio (ej: consultoriojuan.com) o un subdominio de tu web existente (ej: consultorio.psicologojuan.com)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="public_slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug público *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="dra-maria-gonzalez" />
                    </FormControl>
                    <FormDescription>
                      Identificador único para URLs internas. Solo minúsculas, números y guiones.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="submit" 
                  disabled={loading || subdomainAvailable === false} 
                  className="w-full"
                >
                  {loading ? "Guardando..." : "Guardar y continuar"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessSetup;

import { useState } from "react";
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

const businessSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(100),
  specialty: z.string().min(1, "La especialidad es obligatoria").max(100),
  contact_email: z.string().email("Email inválido").max(255),
  public_slug: z
    .string()
    .min(1, "El slug es obligatorio")
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
});

type BusinessFormData = z.infer<typeof businessSchema>;

const BusinessSetup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const form = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: "",
      specialty: "",
      contact_email: "",
      public_slug: "",
    },
  });

  const onSubmit = async (data: BusinessFormData) => {
    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("No se encontró el usuario autenticado");
        navigate("/auth");
        return;
      }

      // Check if business already exists
      const { data: existingBusiness } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (existingBusiness) {
        toast.error("Ya tenés un consultorio configurado");
        navigate("/dashboard");
        return;
      }

      // Create business
      const { error } = await supabase
        .from("businesses")
        .insert([{
          owner_user_id: user.id,
          name: data.name,
          specialty: data.specialty,
          contact_email: data.contact_email,
          public_slug: data.public_slug,
          timezone: "America/Montevideo",
        }]);

      if (error) throw error;

      toast.success("¡Consultorio configurado correctamente!");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error creating business:", error);
      toast.error(error.message || "No se pudo crear el consultorio");
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del consultorio *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Consultorio Dra. María González" />
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
                      Este será usado para tu agenda pública. Solo minúsculas, números y guiones.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="submit" disabled={loading} className="w-full">
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

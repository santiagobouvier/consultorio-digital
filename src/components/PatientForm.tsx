import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const patientSchema = z.object({
  full_name: z.string().min(1, "El nombre es obligatorio").max(100),
  email: z
    .string()
    .max(255)
    .optional()
    .refine(
      (val) => !val || val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      "Email inválido"
    ),
  whatsapp_phone: z.string().max(50).optional(),
  reason_for_consultation: z.string().max(500).optional(),
  private_notes: z.string().max(2000).optional(),
  is_active: z.boolean().default(true),
});

type PatientFormData = z.infer<typeof patientSchema>;

interface PatientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId?: string;
  initialData?: PatientFormData;
  onSuccess: () => void;
}

export function PatientForm({
  open,
  onOpenChange,
  patientId,
  initialData,
  onSuccess,
}: PatientFormProps) {
  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: initialData || {
      full_name: "",
      email: "",
      whatsapp_phone: "",
      reason_for_consultation: "",
      private_notes: "",
      is_active: true,
    },
  });

  const onSubmit = async (data: PatientFormData) => {
    try {
      // Get current user's business
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "No se encontró el usuario autenticado",
          variant: "destructive",
        });
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        toast({
          title: "Configuración necesaria",
          description: "Primero configurá tu consultorio antes de crear pacientes.",
        });
        window.location.href = "/configurar-negocio";
        return;
      }

      // Clean empty strings to null
      const cleanData = {
        ...data,
        email: data.email?.trim() || null,
        whatsapp_phone: data.whatsapp_phone?.trim() || null,
        reason_for_consultation: data.reason_for_consultation?.trim() || null,
        private_notes: data.private_notes?.trim() || null,
      };

      if (patientId) {
        // Update existing patient
        const { error } = await supabase
          .from("patients")
          .update(cleanData)
          .eq("id", patientId);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Paciente actualizado correctamente",
        });
      } else {
        // Create new patient
        const { error } = await supabase
          .from("patients")
          .insert([{
            business_id: business.id,
            full_name: cleanData.full_name,
            email: cleanData.email,
            whatsapp_phone: cleanData.whatsapp_phone,
            reason_for_consultation: cleanData.reason_for_consultation,
            private_notes: cleanData.private_notes,
            is_active: cleanData.is_active,
          }]);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Paciente creado correctamente",
        });
      }

      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Error saving patient:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el paciente",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {patientId ? "Editar paciente" : "Nuevo paciente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Juan Pérez" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="juan@ejemplo.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono WhatsApp</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+598 99 123 456" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason_for_consultation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo de consulta</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Breve descripción" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="private_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas privadas</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notas solo visibles para el profesional"
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Paciente activo</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {patientId ? "Guardar cambios" : "Crear paciente"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

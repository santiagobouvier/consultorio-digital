import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { checkPatientLimit } from "@/hooks/use-plan-limits";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, User as UserIcon, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  initialData?: PatientFormData & { avatar_url?: string | null };
  onSuccess: () => void;
  /**
   * ID del consultorio activo (respeta el contexto multi-tenant: super admin en modo visita,
   * profesionales no-owners, etc.). Si se pasa, se usa directamente para el upload del avatar
   * y para resolver el business al guardar. Si no, se hace fallback por owner_user_id/user_roles.
   */
  businessId?: string | null;
}

const MAX_AVATAR_SIZE = 3 * 1024 * 1024; // 3 MB

export function PatientForm({
  open,
  onOpenChange,
  patientId,
  initialData,
  onSuccess,
  businessId,
}: PatientFormProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData?.avatar_url ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Pre-generate a stable UUID for new patients so we can use it in storage paths
  // before the DB insert. Reset each time the dialog opens for a new patient.
  const preGeneratedId = useMemo(() => crypto.randomUUID(), [open, patientId]);

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

  // Resetear estado al abrir/cerrar
  useEffect(() => {
    if (open) {
      setAvatarUrl(initialData?.avatar_url ?? null);
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Defensa anti-submit: aunque <input type="file"> no debería disparar submit,
    // detenemos cualquier propagación del evento change para evitar que algún
    // listener del form lo interprete como envío.
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Archivo inválido",
        description: "Subí una imagen (JPG, PNG, WEBP).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast({
        title: "Imagen muy grande",
        description: "La foto debe pesar menos de 3 MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploadingAvatar(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      // Use businessId context when available; fallback to user folder.
      // For new patients we use the pre-generated ID so the path is deterministic.
      const fileId = patientId || preGeneratedId;
      const path = businessId
        ? `business-avatars/${businessId}/${fileId}.${ext}`
        : `${user.id}/patient-avatars/${fileId}.${ext}`;

      // DEBUG: mostrar info de upload
      toast({
        title: "📋 Debug Upload",
        description: `UUID: ${fileId} | businessId: ${businessId ?? "null"} | path: ${path}`,
      });

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        toast({
          title: "❌ Error Storage",
          description: `Code: ${(uploadError as any).statusCode ?? "?"} | ${uploadError.message}`,
          variant: "destructive",
        });
        throw uploadError;
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast({ title: "Foto cargada", description: "Se guardará al confirmar." });
    } catch (err: any) {
      console.error("Error subiendo avatar:", err);
      toast({
        title: "No se pudo subir la foto",
        description: err?.message || "Intentá de nuevo",
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const removeAvatar = () => setAvatarUrl(null);

  const onSubmit = async (data: PatientFormData) => {
    if (isSubmitting) return; // doble guardia anti doble-click
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "No se encontró el usuario autenticado",
          variant: "destructive",
        });
        return;
      }

      // Resolver business
      // Priorizar businessId del contexto (respeta super admin en modo visita y no-owners).
      let business: { id: string } | null = businessId ? { id: businessId } : null;

      if (!business) {
        const { data: owned } = await supabase
          .from("businesses")
          .select("id")
          .eq("owner_user_id", user.id)
          .maybeSingle();
        if (owned) business = { id: owned.id };
      }

      if (!business) {
        const { data: userRole } = await supabase
          .from("user_roles")
          .select("business_id")
          .eq("user_id", user.id)
          .in("role", ["owner", "professional"])
          .maybeSingle();

        if (userRole?.business_id) {
          business = { id: userRole.business_id };
        }
      }

      if (!business) {
        toast({
          title: "Configuración necesaria",
          description: "Primero configurá tu consultorio antes de crear pacientes.",
        });
        navigate("/configurar-negocio", { replace: true });
        return;
      }

      // Límite de plan (solo para nuevos)
      if (!patientId) {
        const limitCheck = await checkPatientLimit(business.id);
        if (!limitCheck.canAdd) {
          toast({
            title: "Límite de pacientes alcanzado",
            description: limitCheck.message,
            variant: "destructive",
          });
          return;
        }
      }

      // Limpiar/normalizar campos
      const cleanEmail = data.email?.trim().toLowerCase() || null;
      const cleanPhoneRaw = data.whatsapp_phone?.trim() || null;
      const cleanPhoneDigits = cleanPhoneRaw ? cleanPhoneRaw.replace(/\D/g, "") : null;

      // Validación previa de duplicados (más amigable que esperar el error de DB)
      if (cleanEmail || cleanPhoneDigits) {
        const { data: existing } = await supabase
          .from("patients")
          .select("id, email, whatsapp_phone")
          .eq("business_id", business.id);

        const dupEmail = cleanEmail
          ? existing?.find(
              (p) =>
                p.id !== patientId &&
                p.email &&
                p.email.toLowerCase() === cleanEmail
            )
          : null;
        const dupPhone = cleanPhoneDigits
          ? existing?.find(
              (p) =>
                p.id !== patientId &&
                p.whatsapp_phone &&
                p.whatsapp_phone.replace(/\D/g, "") === cleanPhoneDigits
            )
          : null;

        if (dupEmail) {
          toast({
            title: "Email duplicado",
            description: "Ya existe un paciente en este consultorio con ese email.",
            variant: "destructive",
          });
          return;
        }
        if (dupPhone) {
          toast({
            title: "WhatsApp duplicado",
            description: "Ya existe un paciente en este consultorio con ese número de WhatsApp.",
            variant: "destructive",
          });
          return;
        }
      }

      const cleanData = {
        full_name: data.full_name.trim(),
        email: cleanEmail,
        whatsapp_phone: cleanPhoneRaw,
        reason_for_consultation: data.reason_for_consultation?.trim() || null,
        private_notes: data.private_notes?.trim() || null,
        is_active: data.is_active,
        avatar_url: avatarUrl,
      };

      if (patientId) {
        const { error } = await supabase
          .from("patients")
          .update(cleanData)
          .eq("id", patientId);

        if (error) throw error;

        toast({ title: "Éxito", description: "Paciente actualizado correctamente" });
        form.reset();
        onSuccess();
      } else {
        const { data: newPatient, error } = await supabase
          .from("patients")
          .insert([{ id: preGeneratedId, business_id: business.id, ...cleanData }])
          .select("id")
          .single();

        if (error) throw error;

        toast({ title: "Éxito", description: "Paciente creado correctamente" });
        form.reset();
        setAvatarUrl(null);
        onOpenChange(false);

        if (newPatient?.id) {
          navigate(`/patients/${newPatient.id}`);
        } else {
          onSuccess();
        }
      }
    } catch (error: any) {
      console.error("Error completo al guardar paciente:", error);
      // Detectar violación de unicidad desde DB (por si la validación previa falla por race condition)
      const msg = String(error?.message || "");
      if (msg.includes("patients_business_email_unique")) {
        toast({
          title: "Email duplicado",
          description: "Ya existe un paciente en este consultorio con ese email.",
          variant: "destructive",
        });
      } else if (msg.includes("patients_business_phone_unique")) {
        toast({
          title: "WhatsApp duplicado",
          description: "Ya existe un paciente en este consultorio con ese número de WhatsApp.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: `No se pudo guardar el paciente. ${error?.message || JSON.stringify(error)}`,
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = (form.watch("full_name") || "").trim().split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
    {createPortal(
      <input
        ref={fileInputRef}
        id="patient-avatar-input"
        type="file"
        accept="image/*"
        style={{ position: "fixed", top: -9999, left: -9999, opacity: 0, pointerEvents: "none" }}
        onChange={handleAvatarChange}
        onClick={(e) => e.stopPropagation()}
        disabled={uploadingAvatar || isSubmitting}
      />,
      document.body
    )}
    <Dialog open={open} onOpenChange={(v) => { if (!isSubmitting) onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-xl font-bold">
            {patientId ? "Editar paciente" : "Nuevo paciente"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Avatar section */}
            {patientId ? (
              /* Edit mode: full upload functionality */
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border border-border/40">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="Foto de perfil" />
                  ) : null}
                  <AvatarFallback className="bg-muted text-muted-foreground">
                    {initials || <UserIcon className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-2"
                    disabled={uploadingAvatar || isSubmitting}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    {avatarUrl ? "Cambiar foto" : "Subir foto"}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl gap-2 text-destructive hover:text-destructive"
                      onClick={removeAvatar}
                      disabled={uploadingAvatar || isSubmitting}
                    >
                      <X className="h-4 w-4" />
                      Quitar foto
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">JPG, PNG o WEBP. Máx 3 MB.</p>
                </div>
              </div>
            ) : (
              /* Create mode: placeholder avatar with dynamic initials */
              <div className="flex flex-col items-center gap-2 py-1">
                <div className="relative">
                  <Avatar className="h-20 w-20 border border-border/40">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">
                      {initials || <UserIcon className="h-8 w-8" />}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                    <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Agregá la foto desde el perfil del paciente
                </p>
              </div>
            )}

            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Nombre completo *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Juan Pérez"
                      className="h-12 text-base rounded-xl"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Email</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="juan@ejemplo.com"
                      className="h-12 text-base rounded-xl"
                      disabled={isSubmitting}
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
                  <FormLabel className="text-sm font-semibold">Teléfono WhatsApp</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="+598 99 123 456"
                      className="h-12 text-base rounded-xl"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason_for_consultation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold">Motivo de consulta</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Breve descripción"
                      className="h-12 text-base rounded-xl"
                      disabled={isSubmitting}
                    />
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
                  <FormLabel className="text-sm font-semibold">Notas privadas</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Notas solo visibles para el profesional"
                      rows={3}
                      className="text-base rounded-xl resize-none"
                      disabled={isSubmitting}
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
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 bg-muted/50 rounded-xl">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="h-5 w-5"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormLabel className="text-sm font-medium cursor-pointer">
                    Paciente activo
                  </FormLabel>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-12 rounded-xl text-base font-semibold flex-1"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="h-12 rounded-xl text-base font-semibold flex-1"
                disabled={isSubmitting || uploadingAvatar}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : patientId ? (
                  "Guardar cambios"
                ) : (
                  "Crear paciente"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}

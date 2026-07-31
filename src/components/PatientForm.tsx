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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, User as UserIcon, X, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AGREED_FREQUENCY_LABELS,
  PAYMENT_TYPE_LABELS,
  TREATMENT_STATUS_LABELS,
  computeAge,
  isMinor,
} from "@/lib/patient-profile";

const emailField = z
  .string()
  .max(255)
  .optional()
  .refine(
    (val) => !val || val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    "Email inválido"
  );

const patientSchema = z.object({
  full_name: z.string().min(1, "El nombre es obligatorio").max(100),
  email: emailField,
  whatsapp_phone: z.string().max(50).optional(),
  // Datos personales
  birth_date: z
    .string()
    .optional()
    .refine(
      (val) => !val || val <= new Date().toISOString().slice(0, 10),
      "La fecha de nacimiento no puede ser futura"
    ),
  document_id: z.string().max(50).optional(),
  // Contacto de emergencia
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_relationship: z.string().max(50).optional(),
  emergency_contact_phone: z.string().max(50).optional(),
  // Adulto responsable (menores)
  guardian_name: z.string().max(100).optional(),
  guardian_relationship: z.string().max(50).optional(),
  guardian_phone: z.string().max(50).optional(),
  guardian_email: emailField,
  // Tratamiento
  reason_for_consultation: z.string().max(500).optional(),
  first_consultation_date: z.string().optional(),
  referred_by: z.string().max(100).optional(),
  treatment_status: z.string().optional(),
  agreed_frequency: z.string().optional(),
  // Administrativo
  health_insurance: z.string().max(100).optional(),
  payment_type: z.string().optional(),
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

  const emptyValues: PatientFormData = {
    full_name: "",
    email: "",
    whatsapp_phone: "",
    birth_date: "",
    document_id: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "",
    emergency_contact_phone: "",
    guardian_name: "",
    guardian_relationship: "",
    guardian_phone: "",
    guardian_email: "",
    reason_for_consultation: "",
    first_consultation_date: "",
    referred_by: "",
    treatment_status: "",
    agreed_frequency: "",
    health_insurance: "",
    payment_type: "",
    private_notes: "",
    is_active: true,
  };

  const form = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: initialData ? { ...emptyValues, ...initialData } : emptyValues,
  });

  // La sección de adulto responsable aparece sola cuando la fecha de
  // nacimiento indica que el paciente es menor de 18.
  const watchedBirthDate = form.watch("birth_date");
  const patientIsMinor = isMinor(watchedBirthDate || null);
  const patientAge = computeAge(watchedBirthDate || null);

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

      // upsert: la ruta es determinística por paciente, así cambiar la foto
      // reemplaza la anterior en vez de fallar por duplicado.
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-buster: al reemplazar la foto la URL es la misma; sin esto el
      // navegador seguiría mostrando la imagen vieja.
      setAvatarUrl(`${pub.publicUrl}?v=${Date.now()}`);
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

      const opt = (v: string | undefined) => v?.trim() || null;
      const cleanData = {
        full_name: data.full_name.trim(),
        email: cleanEmail,
        whatsapp_phone: cleanPhoneRaw,
        birth_date: opt(data.birth_date),
        document_id: opt(data.document_id),
        emergency_contact_name: opt(data.emergency_contact_name),
        emergency_contact_relationship: opt(data.emergency_contact_relationship),
        emergency_contact_phone: opt(data.emergency_contact_phone),
        guardian_name: opt(data.guardian_name),
        guardian_relationship: opt(data.guardian_relationship),
        guardian_phone: opt(data.guardian_phone),
        guardian_email: data.guardian_email?.trim().toLowerCase() || null,
        reason_for_consultation: opt(data.reason_for_consultation),
        first_consultation_date: opt(data.first_consultation_date),
        referred_by: opt(data.referred_by),
        agreed_frequency: opt(data.agreed_frequency),
        health_insurance: opt(data.health_insurance),
        payment_type: opt(data.payment_type),
        private_notes: opt(data.private_notes),
        is_active: data.is_active,
        avatar_url: avatarUrl,
      };

      // El estado del tratamiento es clínico: vive en patient_clinical_status
      // (tabla que el paciente no puede leer), no en patients.
      const saveTreatmentStatus = async (pid: string) => {
        const ts = opt(data.treatment_status);
        const changed = ts !== (initialData?.treatment_status?.trim() || null);
        if (!changed) return;
        const { error } = await supabase
          .from("patient_clinical_status")
          .upsert(
            { patient_id: pid, business_id: business!.id, treatment_status: ts },
            { onConflict: "patient_id" }
          );
        if (error) throw error;
      };

      if (patientId) {
        const { error } = await supabase
          .from("patients")
          .update(cleanData)
          .eq("id", patientId);

        if (error) throw error;
        await saveTreatmentStatus(patientId);

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
        if (newPatient?.id) await saveTreatmentStatus(newPatient.id);

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
    {patientId && createPortal(
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
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
                <Avatar className="h-16 w-16 border border-border/40">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xl font-semibold">
                    {initials || <UserIcon className="h-7 w-7" />}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[11px] text-muted-foreground text-center">
                  Podrás subir la foto luego de crear el paciente
                </p>
              </div>
            )}

            {/* ── Datos personales ── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Datos personales
              </p>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="birth_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">
                        Fecha de nacimiento
                        {patientAge !== null && (
                          <span className="ml-2 font-normal text-muted-foreground">
                            ({patientAge} {patientAge === 1 ? "año" : "años"})
                          </span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="date"
                          max={new Date().toISOString().slice(0, 10)}
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
                  name="document_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Documento</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="CI 1.234.567-8"
                          className="h-12 text-base rounded-xl"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              </div>
            </div>

            {/* ── Adulto responsable: aparece solo si es menor de 18 ── */}
            {patientIsMinor && (
              <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Adulto responsable
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Paciente menor de edad — los recordatorios se envían al adulto responsable.
                    </p>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="guardian_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Nombre</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="María Pérez" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="guardian_relationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Vínculo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Madre, padre, tutor..." className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="guardian_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold">Teléfono</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="+598 99 123 456" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="guardian_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="maria@ejemplo.com" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* ── Contacto de emergencia ── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Contacto de emergencia
              </p>
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Ana Rodríguez" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="emergency_contact_relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Vínculo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Hermana, pareja..." className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergency_contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Teléfono</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+598 99 123 456" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Tratamiento ── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tratamiento
              </p>
              <FormField
                control={form.control}
                name="reason_for_consultation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Motivo de consulta inicial</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Por qué consulta"
                        rows={2}
                        className="text-base rounded-xl resize-none"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_consultation_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Primera consulta</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="referred_by"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Derivado por</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Colega, mutualista, conocido..." className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="treatment_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Estado del tratamiento</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base rounded-xl">
                            <SelectValue placeholder="Sin especificar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin especificar</SelectItem>
                          {Object.entries(TREATMENT_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="agreed_frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Frecuencia acordada</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base rounded-xl">
                            <SelectValue placeholder="Sin especificar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin especificar</SelectItem>
                          {Object.entries(AGREED_FREQUENCY_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* ── Administrativo ── */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Administrativo
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="health_insurance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Mutualista u obra social</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Médica Uruguaya" className="h-12 text-base rounded-xl" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="payment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">Tipo de atención</FormLabel>
                      <Select
                        value={field.value || "none"}
                        onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12 text-base rounded-xl">
                            <SelectValue placeholder="Sin especificar" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Sin especificar</SelectItem>
                          {Object.entries(PAYMENT_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { PatientBookingModal } from "@/components/PatientBookingModal";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { AlertTriangle } from "lucide-react";
import {
  PatientPortalView,
  type PortalBranding,
  type PortalPatient,
  type PortalAppointment,
  type PortalPayment,
  type ProfileEditData,
} from "@/components/portal/PatientPortalView";
import {
  calculatePaymentStatus,
  getRecurrenceTypeLabel,
  RecurrenceType,
} from "@/lib/payments";

const PatientPortal = () => {
  const navigate = useNavigate();
  const { canInstall, install, isInstalled } = usePWAInstall();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PortalPatient | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [businessSlug, setBusinessSlug] = useState<string | null>(null);
  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<PortalAppointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<PortalAppointment[]>([]);
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("portal-theme");
    return stored ? stored === "dark" : true;
  });
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<PortalAppointment | null>(null);

  useEffect(() => {
    localStorage.setItem("portal-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }

      const { data: roleData } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "patient").maybeSingle();
      if (!roleData) { navigate("/dashboard"); return; }

      // Lista explícita de columnas: el portal del paciente solo trae lo que
      // muestra. Nunca agregar acá campos clínicos ni administrativos.
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("id, business_id, full_name, email, whatsapp_phone, avatar_url, reason_for_consultation, private_notes, created_at")
        .eq("auth_user_id", user.id).maybeSingle();
      if (patientError) throw patientError;
      if (!patientData) {
        setError("No encontramos tu ficha de paciente. Contactá a tu profesional.");
        setLoading(false); return;
      }
      setPatient(patientData as PortalPatient);
      setBusinessId(patientData.business_id);

      const { data: businessData } = await supabase
        .from("businesses")
        .select("id, name, specialty, contact_email, portal_logo_url, portal_clinic_display_name, portal_primary_color, portal_dark_primary_color, public_slug, cancellation_hours_notice, late_cancellation_message")
        .eq("id", patientData.business_id).maybeSingle();
      if (businessData) {
        setBusinessSlug((businessData as any).public_slug || null);
        setBranding({
          name: (businessData as any).portal_clinic_display_name || businessData.name || "Mi Consultorio",
          specialty: businessData.specialty || "Salud",
          contactEmail: businessData.contact_email || "",
          logoUrl: (businessData as any).portal_logo_url || "",
          lightColor: (businessData as any).portal_primary_color || "176 100% 32%",
          darkColor: (businessData as any).portal_dark_primary_color || "176 85% 42%",
          cancellationHoursNotice: (businessData as any).cancellation_hours_notice ?? 24,
          lateCancellationMessage: (businessData as any).late_cancellation_message ?? null,
        });
      }

      const now = new Date().toISOString();
      // El portal muestra SOLO patient_note (la nota escrita para el
      // paciente). Las "Notas internas" de la cita no se piden nunca acá.
      const { data: upcomingData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location, patient_note, services(name)")
        .eq("patient_id", patientData.id).eq("business_id", patientData.business_id)
        .gte("start_at", now).neq("status", "cancelled")
        .order("start_at", { ascending: true });
      setUpcomingAppointments((upcomingData || []).map((a: any): PortalAppointment => ({
        id: a.id, start_at: a.start_at, end_at: a.end_at, status: a.status,
        modality: a.modality, location: a.location, notes: a.patient_note,
        service_name: a.services?.name ?? null, payment_status: null,
      })));

      const { data: pastData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location, patient_note, services(name)")
        .eq("patient_id", patientData.id).eq("business_id", patientData.business_id)
        .lt("start_at", now)
        .order("start_at", { ascending: false }).limit(50);
      setPastAppointments((pastData || []).map((a: any): PortalAppointment => ({
        id: a.id, start_at: a.start_at, end_at: a.end_at, status: a.status,
        modality: a.modality, location: a.location, notes: a.patient_note,
        service_name: a.services?.name ?? null, payment_status: null,
      })));

      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, amount, currency, due_date, status, paid_at, recurrence_type, notes")
        .eq("patient_id", patientData.id).eq("business_id", patientData.business_id)
        .order("due_date", { ascending: false }).limit(50);
      if (paymentsData) {
        setPayments(paymentsData.map((p: any): PortalPayment => ({
          id: p.id, amount: Number(p.amount), currency: p.currency || "UYU",
          due_date: p.due_date,
          status: calculatePaymentStatus({ due_date: p.due_date, paid_at: p.paid_at, status: p.status }),
          paid_at: p.paid_at,
          recurrence_label: getRecurrenceTypeLabel(p.recurrence_type as RecurrenceType),
          notes: p.notes, appointment_id: null,
        })));
      }
    } catch (err: any) {
      console.error("Error loading patient portal:", err);
      setError("Error al cargar los datos. Intentá nuevamente más tarde.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (businessSlug) navigate(`/portal/${businessSlug}`);
    else navigate("/");
  };

  const handleSaveProfile = async (data: ProfileEditData, avatarFile: File | null) => {
    if (!patient) return;
    try {
      let avatar_url = patient.avatar_url;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `patient-avatars/${patient.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars").upload(path, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatar_url = pub.publicUrl;
      }
      const { error } = await supabase.from("patients").update({
        full_name: data.full_name,
        email: data.email || null,
        whatsapp_phone: data.whatsapp_phone || null,
        reason_for_consultation: data.reason_for_consultation || null,
        avatar_url,
      }).eq("id", patient.id);
      if (error) throw error;
      setPatient({ ...patient, full_name: data.full_name, email: data.email || null, whatsapp_phone: data.whatsapp_phone || null, reason_for_consultation: data.reason_for_consultation || null, avatar_url });
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." });
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error", description: "No se pudo guardar. Intentá de nuevo.", variant: "destructive" });
    }
  };

  const handleCancelAppointment = async (appointmentId: string, reason: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const apt = [...upcomingAppointments, ...pastAppointments].find(a => a.id === appointmentId);
      // Free associated slot if it exists
      const { data: aptRow } = await supabase
        .from("appointments")
        .select("availability_slot_id")
        .eq("id", appointmentId)
        .maybeSingle();
      const { error } = await supabase.from("appointments").update({
        status: "cancelled_by_patient",
        cancelled_at: new Date().toISOString(),
        cancelled_by: user?.id || null,
        cancellation_reason: reason || null,
      }).eq("id", appointmentId);
      if (error) throw error;
      if (aptRow?.availability_slot_id) {
        await supabase.from("availability_slots")
          .update({ status: "available" })
          .eq("id", aptRow.availability_slot_id);
      }
      toast({ title: "Cita cancelada", description: "Avisamos al profesional." });
      await loadData();
    } catch (err: any) {
      console.error(err);
      // Trigger de la base: cancelación fuera del plazo del consultorio
      const windowClosed = String(err?.message || "").includes("cancellation_window_closed");
      toast({
        title: windowClosed ? "Ya no se puede cancelar desde acá" : "Error",
        description: windowClosed
          ? "Falta poco para tu cita: para cancelarla contactá directamente a tu profesional."
          : "No se pudo cancelar la cita.",
        variant: "destructive",
      });
    }
  };

  const handleRescheduleAppointment = (apt: PortalAppointment) => {
    setRescheduleTarget(apt);
    setShowBookingModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (error || !patient || !branding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{error || "Error al cargar."}</p>
            <Button variant="outline" className="mt-4"
              onClick={() => businessSlug ? navigate(`/portal/${businessSlug}`) : navigate("/")}>
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PatientPortalView
      branding={branding}
      patient={patient}
      upcomingAppointments={upcomingAppointments}
      pastAppointments={pastAppointments}
      payments={payments}
      isDark={isDark}
      onToggleDark={() => setIsDark(d => !d)}
      canInstall={canInstall}
      isInstalled={isInstalled}
      onInstallApp={() => { if (canInstall) install(); else window.open(window.location.href, "_blank", "noopener,noreferrer"); }}
      showPwaBannerTop
      headerAction="logout"
      onLogout={handleLogout}
      onBookAppointment={() => setShowBookingModal(true)}
      onSaveProfile={handleSaveProfile}
      onCancelAppointment={handleCancelAppointment}
      onRescheduleAppointment={handleRescheduleAppointment}
      extras={businessId && (
        <PatientBookingModal
          open={showBookingModal}
          onOpenChange={(o) => { setShowBookingModal(o); if (!o) setRescheduleTarget(null); }}
          businessId={businessId}
          patientId={patient.id}
          rescheduleAppointment={rescheduleTarget ? { id: rescheduleTarget.id, start_at: rescheduleTarget.start_at, end_at: rescheduleTarget.end_at } : null}
          onSuccess={() => loadData()}
          branding={{ name: branding.name, logoUrl: branding.logoUrl, cancellationHoursNotice: branding.cancellationHoursNotice }}
        />
      )}
    />
  );
};

export default PatientPortal;
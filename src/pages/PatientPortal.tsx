import { useEffect, useState } from "react";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { 
  User, Calendar, CreditCard, Clock, AlertTriangle, MapPin, Video, 
  Phone, Mail, Building2, CheckCircle2, AlertCircle, XCircle, 
  LogOut, Plus, Edit2, Save, X, FileText, LayoutDashboard
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { calculatePaymentStatus, formatCurrency, getRecurrenceTypeLabel, PaymentStatus, RecurrenceType } from "@/lib/payments";
import { PatientBookingModal } from "@/components/PatientBookingModal";

interface PatientData {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
  private_notes: string | null;
  created_at: string;
  business_id: string;
}

interface BusinessData {
  id: string;
  name: string;
  specialty: string | null;
  contact_email: string;
}

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  location: string | null;
  notes: string | null;
  service?: { name: string } | null;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  paid_at: string | null;
  recurrence_type: string;
  notes: string | null;
}

const PatientPortal = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", email: "", whatsapp_phone: "", reason_for_consultation: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: roleData } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "patient").maybeSingle();

      if (!roleData) { navigate("/dashboard"); return; }

      const { data: patientData, error: patientError } = await supabase
        .from("patients").select("*")
        .eq("auth_user_id", user.id).maybeSingle();

      if (patientError) throw patientError;
      if (!patientData) {
        setError("No encontramos tu ficha de paciente. Contactá a tu profesional.");
        setLoading(false);
        return;
      }

      setPatient(patientData);
      setProfileForm({
        full_name: patientData.full_name || "",
        email: patientData.email || "",
        whatsapp_phone: patientData.whatsapp_phone || "",
        reason_for_consultation: patientData.reason_for_consultation || "",
      });

      // Load business
      const { data: businessData } = await supabase
        .from("businesses").select("id, name, specialty, contact_email")
        .eq("id", patientData.business_id).maybeSingle();
      if (businessData) setBusiness(businessData);

      const now = new Date().toISOString();

      // Load upcoming appointments with service name
      const { data: upcomingData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location, notes, services(name)")
        .eq("patient_id", patientData.id)
        .eq("business_id", patientData.business_id)
        .gte("start_at", now)
        .neq("status", "cancelled")
        .order("start_at", { ascending: true });

      setUpcomingAppointments((upcomingData || []).map((a: any) => ({ ...a, service: a.services })));

      // Load past appointments
      const { data: pastData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, location, notes, services(name)")
        .eq("patient_id", patientData.id)
        .eq("business_id", patientData.business_id)
        .lt("start_at", now)
        .order("start_at", { ascending: false })
        .limit(50);

      setPastAppointments((pastData || []).map((a: any) => ({ ...a, service: a.services })));

      // Load payments
      const { data: paymentsData } = await supabase
        .from("payments")
        .select("id, amount, currency, due_date, status, paid_at, recurrence_type, notes")
        .eq("patient_id", patientData.id)
        .eq("business_id", patientData.business_id)
        .order("due_date", { ascending: false })
        .limit(50);

      if (paymentsData) {
        setPayments(paymentsData.map(p => ({
          ...p,
          status: calculatePaymentStatus({ due_date: p.due_date, paid_at: p.paid_at, status: p.status })
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

  const handleSaveProfile = async () => {
    if (!patient) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("patients")
        .update({
          full_name: profileForm.full_name,
          email: profileForm.email || null,
          whatsapp_phone: profileForm.whatsapp_phone || null,
          reason_for_consultation: profileForm.reason_for_consultation || null,
        })
        .eq("id", patient.id);

      if (error) throw error;
      setPatient({ ...patient, ...profileForm });
      setEditingProfile(false);
      toast({ title: "Perfil actualizado", description: "Tus datos se guardaron correctamente." });
    } catch (err: any) {
      toast({ title: "Error", description: "No se pudo guardar. Intentá de nuevo.", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getAppointmentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendiente" },
      confirmed: { variant: "default", label: "Confirmada" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      completed: { variant: "outline", label: "Completada" },
      no_show: { variant: "destructive", label: "Ausente" },
    };
    const config = variants[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string }> = {
      paid: { className: "bg-green-600 text-white hover:bg-green-600", label: "Pagado" },
      pending: { className: "bg-secondary text-secondary-foreground", label: "Pendiente" },
      due_soon: { className: "bg-orange-500 text-white hover:bg-orange-500", label: "Por vencer" },
      overdue: { className: "bg-destructive text-destructive-foreground hover:bg-destructive", label: "Vencido" },
      cancelled: { className: "bg-muted text-muted-foreground", label: "Cancelado" },
    };
    const config = variants[status] || { className: "bg-secondary", label: status };
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  // Stats
  const totalSessions = pastAppointments.filter(a => a.status === "completed").length;
  const pendingPayments = payments.filter(p => p.status !== "paid" && p.status !== "cancelled");
  const overduePayments = pendingPayments.filter(p => p.status === "overdue");
  const totalPaid = payments.filter(p => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);

  const overallPaymentStatus = (() => {
    if (pendingPayments.length === 0) return { status: "paid" as const, message: "Estás al día con tus pagos", color: "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300" };
    if (overduePayments.length > 0) return { status: "overdue" as const, message: "Tenés pagos vencidos", color: "bg-destructive/10 border-destructive/20 text-destructive" };
    return { status: "pending" as const, message: "Tenés pagos pendientes", color: "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300" };
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/auth")}>Volver al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Mi Portal</h1>
            {business && <p className="text-xs text-muted-foreground">{business.name}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-4">
        {/* Payment Status Banner */}
        <div className={`rounded-lg border p-3 mb-4 ${overallPaymentStatus.color}`}>
          <div className="flex items-center gap-2">
            {overallPaymentStatus.status === "paid" && <CheckCircle2 className="h-5 w-5" />}
            {overallPaymentStatus.status === "overdue" && <AlertTriangle className="h-5 w-5" />}
            {overallPaymentStatus.status === "pending" && <Clock className="h-5 w-5" />}
            <span className="font-medium text-sm">{overallPaymentStatus.message}</span>
          </div>
        </div>

        {/* PWA Install Banner */}
        <PWAInstallBanner />

        {/* Push Notification Activation */}
        <div className="mb-4">
          <NotificationActivationCard variant="full" />
        </div>

        <Tabs defaultValue="resumen" className="w-full">
          <TabsList className="w-full grid grid-cols-5 mb-4">
            <TabsTrigger value="resumen" className="text-xs sm:text-sm">
              <LayoutDashboard className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="citas" className="text-xs sm:text-sm">
              <Calendar className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Citas</span>
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
            <TabsTrigger value="pagos" className="text-xs sm:text-sm">
              <CreditCard className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="perfil" className="text-xs sm:text-sm">
              <User className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== RESUMEN (Dashboard) ===== */}
          <TabsContent value="resumen" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-primary">{upcomingAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Próximas citas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold">{totalSessions}</p>
                  <p className="text-xs text-muted-foreground">Sesiones realizadas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-orange-500">{pendingPayments.length}</p>
                  <p className="text-xs text-muted-foreground">Pagos pendientes</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid, "UYU")}</p>
                  <p className="text-xs text-muted-foreground">Total pagado</p>
                </CardContent>
              </Card>
            </div>

            {/* Next appointment */}
            {upcomingAppointments.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Próxima cita</CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const next = upcomingAppointments[0];
                    return (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{format(parseISO(next.start_at), "EEEE d 'de' MMMM", { locale: es })}</p>
                          <p className="text-sm text-muted-foreground">{format(parseISO(next.start_at), "HH:mm")} - {format(parseISO(next.end_at), "HH:mm")} hs</p>
                          {next.service && <p className="text-xs text-muted-foreground mt-1">{next.service.name}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          {next.modality === "online" || next.modality === "virtual" 
                            ? <Video className="h-5 w-5 text-primary" /> 
                            : <MapPin className="h-5 w-5 text-muted-foreground" />}
                          {getAppointmentStatusBadge(next.status)}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            <Button onClick={() => setShowBookingModal(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Reservar una cita
            </Button>

            {/* Recent notes from professional */}
            {patient?.private_notes && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Notas de tu profesional
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{patient.private_notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== CITAS ===== */}
          <TabsContent value="citas" className="space-y-4">
            <Button onClick={() => setShowBookingModal(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Reservar una cita
            </Button>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Próximas citas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No tenés próximas citas agendadas</p>
                    <Button variant="outline" size="sm" onClick={() => setShowBookingModal(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" /> Reservar ahora
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.map((apt) => (
                      <div key={apt.id} className="border rounded-lg p-4 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{format(parseISO(apt.start_at), "EEEE d 'de' MMMM", { locale: es })}</p>
                            <p className="text-sm text-muted-foreground">{format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs</p>
                            {apt.service && <p className="text-xs text-primary mt-1">{apt.service.name}</p>}
                          </div>
                          {getAppointmentStatusBadge(apt.status)}
                        </div>
                        {(apt.modality || apt.location) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {apt.modality === "online" || apt.modality === "virtual" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                            <span className="capitalize">{apt.modality === "online" || apt.modality === "virtual" ? "Sesión online" : apt.location || "Presencial"}</span>
                          </div>
                        )}
                        {apt.notes && <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{apt.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== HISTORIAL ===== */}
          <TabsContent value="historial" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Historial de sesiones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pastAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No tenés citas anteriores</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pastAppointments.map((apt) => (
                      <div key={apt.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{format(parseISO(apt.start_at), "d 'de' MMMM yyyy", { locale: es })}</p>
                            <p className="text-xs text-muted-foreground">{format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs</p>
                            {apt.service && <p className="text-xs text-primary mt-0.5">{apt.service.name}</p>}
                          </div>
                          {getAppointmentStatusBadge(apt.status)}
                        </div>
                        {apt.notes && (
                          <div className="border-t pt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Notas de la sesión</p>
                            <p className="text-xs text-foreground whitespace-pre-wrap">{apt.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PAGOS ===== */}
          <TabsContent value="pagos" className="space-y-4">
            <div className={`rounded-lg border p-4 ${overallPaymentStatus.color}`}>
              <div className="flex items-center gap-3">
                {overallPaymentStatus.status === "paid" && <CheckCircle2 className="h-6 w-6" />}
                {overallPaymentStatus.status === "overdue" && <AlertTriangle className="h-6 w-6" />}
                {overallPaymentStatus.status === "pending" && <Clock className="h-6 w-6" />}
                <div>
                  <p className="font-semibold">{overallPaymentStatus.message}</p>
                  {payments.length > 0 && (
                    <p className="text-xs opacity-80">{payments.filter(p => p.status === "paid").length} de {payments.length} pagos realizados</p>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Detalle de pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">No hay pagos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{formatCurrency(payment.amount, payment.currency)}</p>
                            <p className="text-xs text-muted-foreground">Vence: {format(parseISO(payment.due_date), "d 'de' MMMM yyyy", { locale: es })}</p>
                          </div>
                          {getPaymentStatusBadge(payment.status)}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{getRecurrenceTypeLabel(payment.recurrence_type as RecurrenceType)}</span>
                          {payment.paid_at && <span>Pagado: {format(parseISO(payment.paid_at), "d MMM yyyy", { locale: es })}</span>}
                        </div>
                        {payment.notes && <p className="text-xs text-muted-foreground border-t pt-2">{payment.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== PERFIL ===== */}
          <TabsContent value="perfil" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" /> Mi perfil
                  </CardTitle>
                  {!editingProfile ? (
                    <Button variant="ghost" size="sm" onClick={() => setEditingProfile(true)}>
                      <Edit2 className="h-4 w-4 mr-1" /> Editar
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingProfile(false)} disabled={savingProfile}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile}>
                        <Save className="h-4 w-4 mr-1" /> Guardar
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editingProfile ? (
                  <>
                    <div className="flex items-center gap-3 pb-3 border-b">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{patient?.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Paciente desde {patient?.created_at && format(parseISO(patient.created_at), "MMMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {patient?.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" /><span>{patient.email}</span>
                        </div>
                      )}
                      {patient?.whatsapp_phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" /><span>{patient.whatsapp_phone}</span>
                        </div>
                      )}
                      {patient?.reason_for_consultation && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground mb-1">Motivo de consulta</p>
                          <p className="text-sm">{patient.reason_for_consultation}</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="full_name">Nombre completo</Label>
                      <Input id="full_name" value={profileForm.full_name} onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={profileForm.email} onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="phone">WhatsApp</Label>
                      <Input id="phone" value={profileForm.whatsapp_phone} onChange={e => setProfileForm(f => ({ ...f, whatsapp_phone: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="reason">Motivo de consulta</Label>
                      <Textarea id="reason" value={profileForm.reason_for_consultation} onChange={e => setProfileForm(f => ({ ...f, reason_for_consultation: e.target.value }))} rows={3} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {business && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Mi consultorio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium">{business.name}</p>
                    {business.specialty && <p className="text-sm text-muted-foreground capitalize">{business.specialty}</p>}
                  </div>
                  {business.contact_email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" /><span>{business.contact_email}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {patient && business && (
          <PatientBookingModal
            open={showBookingModal}
            onOpenChange={setShowBookingModal}
            businessId={business.id}
            patientId={patient.id}
            onSuccess={() => {
              const now = new Date().toISOString();
              supabase
                .from("appointments")
                .select("id, start_at, end_at, status, modality, location, notes, services(name)")
                .eq("patient_id", patient.id)
                .gte("start_at", now)
                .neq("status", "cancelled")
                .order("start_at", { ascending: true })
                .then(({ data }) => setUpcomingAppointments((data || []).map((a: any) => ({ ...a, service: a.services }))));
            }}
          />
        )}
      </main>
    </div>
  );
};

export default PatientPortal;

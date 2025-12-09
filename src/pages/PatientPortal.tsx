import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Calendar, 
  CreditCard, 
  Clock, 
  AlertTriangle,
  MapPin,
  Video,
  Phone,
  Mail,
  Building2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  LogOut,
  Plus
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { calculatePaymentStatus, formatCurrency, getRecurrenceTypeLabel, PaymentStatus, RecurrenceType } from "@/lib/payments";
import { PatientBookingModal } from "@/components/PatientBookingModal";

interface PatientData {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
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

  useEffect(() => {
    const checkAccessAndLoadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate("/auth");
          return;
        }

        // Check if user has patient role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "patient")
          .maybeSingle();

        if (!roleData) {
          navigate("/dashboard");
          return;
        }

        // Find patient record linked to this user
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .select("*")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (patientError) throw patientError;

        if (!patientData) {
          setError("No encontramos tu ficha de paciente. Contactá a tu profesional.");
          setLoading(false);
          return;
        }

        setPatient(patientData);

        // Load business data
        const { data: businessData } = await supabase
          .from("businesses")
          .select("id, name, specialty, contact_email")
          .eq("id", patientData.business_id)
          .maybeSingle();

        if (businessData) {
          setBusiness(businessData);
        }

        // Load appointments
        const now = new Date().toISOString();
        
        const { data: upcomingData } = await supabase
          .from("appointments")
          .select("id, start_at, end_at, status, modality, location, notes")
          .eq("patient_id", patientData.id)
          .gte("start_at", now)
          .neq("status", "cancelled")
          .order("start_at", { ascending: true });

        setUpcomingAppointments(upcomingData || []);

        const { data: pastData } = await supabase
          .from("appointments")
          .select("id, start_at, end_at, status, modality, location, notes")
          .eq("patient_id", patientData.id)
          .lt("start_at", now)
          .order("start_at", { ascending: false })
          .limit(20);

        setPastAppointments(pastData || []);

        // Load payments
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("id, amount, currency, due_date, status, paid_at, recurrence_type, notes")
          .eq("patient_id", patientData.id)
          .order("due_date", { ascending: false })
          .limit(20);

        if (paymentsData) {
          const paymentsWithStatus = paymentsData.map(p => ({
            ...p,
            status: calculatePaymentStatus({ 
              due_date: p.due_date, 
              paid_at: p.paid_at, 
              status: p.status 
            })
          }));
          setPayments(paymentsWithStatus);
        }

      } catch (err: any) {
        console.error("Error loading patient portal:", err);
        setError("Error al cargar los datos. Intentá nuevamente más tarde.");
      } finally {
        setLoading(false);
      }
    };

    checkAccessAndLoadData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getAppointmentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      pending: { variant: "secondary", label: "Pendiente", icon: <Clock className="h-3 w-3" /> },
      confirmed: { variant: "default", label: "Confirmada", icon: <CheckCircle2 className="h-3 w-3" /> },
      cancelled: { variant: "destructive", label: "Cancelada", icon: <XCircle className="h-3 w-3" /> },
      completed: { variant: "outline", label: "Completada", icon: <CheckCircle2 className="h-3 w-3" /> },
      no_show: { variant: "destructive", label: "Ausente", icon: <XCircle className="h-3 w-3" /> },
    };
    const config = variants[status] || { variant: "secondary", label: status, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { className: string; label: string; icon: React.ReactNode }> = {
      paid: { className: "bg-green-600 text-white hover:bg-green-600", label: "Pagado", icon: <CheckCircle2 className="h-3 w-3" /> },
      pending: { className: "bg-secondary text-secondary-foreground", label: "Pendiente", icon: <Clock className="h-3 w-3" /> },
      due_soon: { className: "bg-orange-500 text-white hover:bg-orange-500", label: "Por vencer", icon: <AlertCircle className="h-3 w-3" /> },
      overdue: { className: "bg-destructive text-destructive-foreground hover:bg-destructive", label: "Vencido", icon: <AlertTriangle className="h-3 w-3" /> },
      cancelled: { className: "bg-muted text-muted-foreground", label: "Cancelado", icon: <XCircle className="h-3 w-3" /> },
    };
    const config = variants[status] || { className: "bg-secondary", label: status, icon: null };
    return (
      <Badge className={`gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getModalityIcon = (modality: string | null) => {
    if (modality === "online" || modality === "virtual") {
      return <Video className="h-4 w-4 text-muted-foreground" />;
    }
    return <MapPin className="h-4 w-4 text-muted-foreground" />;
  };

  // Calculate overall payment status
  const getOverallPaymentStatus = (): { status: PaymentStatus; message: string; color: string } => {
    const pendingPayments = payments.filter(p => p.status !== 'paid' && p.status !== 'cancelled');
    
    if (pendingPayments.length === 0) {
      return { 
        status: 'paid', 
        message: "Estás al día con tus pagos", 
        color: "bg-green-50 border-green-200 text-green-800" 
      };
    }

    const hasOverdue = pendingPayments.some(p => p.status === 'overdue');
    if (hasOverdue) {
      return { 
        status: 'overdue', 
        message: "Tenés pagos vencidos", 
        color: "bg-destructive/10 border-destructive/20 text-destructive" 
      };
    }

    const hasDueSoon = pendingPayments.some(p => p.status === 'due_soon');
    if (hasDueSoon) {
      return { 
        status: 'due_soon', 
        message: "Tenés un pago próximo a vencer", 
        color: "bg-orange-50 border-orange-200 text-orange-800" 
      };
    }

    return { 
      status: 'pending', 
      message: "Tenés pagos pendientes", 
      color: "bg-secondary border-border text-secondary-foreground" 
    };
  };

  const overallPaymentStatus = getOverallPaymentStatus();

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
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
            <Button variant="outline" className="mt-4" onClick={() => navigate("/auth")}>
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Mi Portal</h1>
            {business && (
              <p className="text-xs text-muted-foreground">{business.name}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-4">
        {/* Quick Status Banner */}
        <div className={`rounded-lg border p-3 mb-4 ${overallPaymentStatus.color}`}>
          <div className="flex items-center gap-2">
            {overallPaymentStatus.status === 'paid' && <CheckCircle2 className="h-5 w-5" />}
            {overallPaymentStatus.status === 'overdue' && <AlertTriangle className="h-5 w-5" />}
            {overallPaymentStatus.status === 'due_soon' && <AlertCircle className="h-5 w-5" />}
            {overallPaymentStatus.status === 'pending' && <Clock className="h-5 w-5" />}
            <span className="font-medium text-sm">{overallPaymentStatus.message}</span>
          </div>
        </div>

        {/* Tabs Navigation */}
        <Tabs defaultValue="citas" className="w-full">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="citas" className="text-xs sm:text-sm">
              <Calendar className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Citas</span>
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs sm:text-sm">
              <Clock className="h-4 w-4 sm:mr-1" />
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

          {/* Próximas Citas */}
          <TabsContent value="citas" className="space-y-4">
            {/* Book appointment button */}
            <Button
              onClick={() => setShowBookingModal(true)}
              className="w-full gap-2"
            >
              <Plus className="h-4 w-4" />
              Reservar una cita
            </Button>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Próximas citas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No tenés próximas citas agendadas
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowBookingModal(true)}
                      className="mt-4 gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Reservar ahora
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.map((apt) => (
                      <div key={apt.id} className="border rounded-lg p-4 space-y-2 bg-card">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">
                              {format(parseISO(apt.start_at), "EEEE d 'de' MMMM", { locale: es })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs
                            </p>
                          </div>
                          {getAppointmentStatusBadge(apt.status)}
                        </div>
                        
                        {(apt.modality || apt.location) && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {getModalityIcon(apt.modality)}
                            <span className="capitalize">
                              {apt.modality === "online" || apt.modality === "virtual" 
                                ? "Sesión online" 
                                : apt.location || "Presencial"}
                            </span>
                          </div>
                        )}

                        {apt.notes && (
                          <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                            {apt.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Historial */}
          <TabsContent value="historial" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Historial de citas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pastAppointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No tenés citas anteriores
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pastAppointments.map((apt) => (
                      <div key={apt.id} className="border rounded-lg p-3 flex items-center justify-between bg-muted/30">
                        <div>
                          <p className="font-medium text-sm">
                            {format(parseISO(apt.start_at), "d 'de' MMMM yyyy", { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")} hs
                          </p>
                        </div>
                        {getAppointmentStatusBadge(apt.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pagos */}
          <TabsContent value="pagos" className="space-y-4">
            {/* Status Summary */}
            <div className={`rounded-lg border p-4 ${overallPaymentStatus.color}`}>
              <div className="flex items-center gap-3">
                {overallPaymentStatus.status === 'paid' && <CheckCircle2 className="h-6 w-6" />}
                {overallPaymentStatus.status === 'overdue' && <AlertTriangle className="h-6 w-6" />}
                {overallPaymentStatus.status === 'due_soon' && <AlertCircle className="h-6 w-6" />}
                {overallPaymentStatus.status === 'pending' && <Clock className="h-6 w-6" />}
                <div>
                  <p className="font-semibold">{overallPaymentStatus.message}</p>
                  {payments.length > 0 && (
                    <p className="text-xs opacity-80">
                      {payments.filter(p => p.status === 'paid').length} de {payments.length} pagos realizados
                    </p>
                  )}
                </div>
              </div>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Detalle de pagos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No hay pagos registrados
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((payment) => (
                      <div key={payment.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {formatCurrency(payment.amount, payment.currency)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Vence: {format(parseISO(payment.due_date), "d 'de' MMMM yyyy", { locale: es })}
                            </p>
                          </div>
                          {getPaymentStatusBadge(payment.status)}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{getRecurrenceTypeLabel(payment.recurrence_type as RecurrenceType)}</span>
                          {payment.paid_at && (
                            <span>
                              Pagado: {format(parseISO(payment.paid_at), "d MMM yyyy", { locale: es })}
                            </span>
                          )}
                        </div>
                        {payment.notes && (
                          <p className="text-xs text-muted-foreground border-t pt-2">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Perfil */}
          <TabsContent value="perfil" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Mi perfil
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{patient.email}</span>
                    </div>
                  )}
                  {patient?.whatsapp_phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{patient.whatsapp_phone}</span>
                    </div>
                  )}
                  {patient?.reason_for_consultation && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Motivo de consulta</p>
                      <p className="text-sm">{patient.reason_for_consultation}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Consultorio Info */}
            {business && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Mi consultorio
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium">{business.name}</p>
                    {business.specialty && (
                      <p className="text-sm text-muted-foreground capitalize">{business.specialty}</p>
                    )}
                  </div>
                  {business.contact_email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{business.contact_email}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Booking Modal */}
        {patient && business && (
          <PatientBookingModal
            open={showBookingModal}
            onOpenChange={setShowBookingModal}
            businessId={business.id}
            patientId={patient.id}
            onSuccess={() => {
              // Reload appointments
              const now = new Date().toISOString();
              supabase
                .from("appointments")
                .select("id, start_at, end_at, status, modality, location, notes")
                .eq("patient_id", patient.id)
                .gte("start_at", now)
                .neq("status", "cancelled")
                .order("start_at", { ascending: true })
                .then(({ data }) => setUpcomingAppointments(data || []));
            }}
          />
        )}
      </main>
    </div>
  );
};

export default PatientPortal;

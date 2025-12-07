import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Calendar, CreditCard, Clock, AlertTriangle } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";

interface PatientData {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
  created_at: string;
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
}

const PatientPortal = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([]);
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

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
          // Not a patient, redirect to dashboard
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

        // Load appointments
        const now = new Date().toISOString();
        
        const { data: upcomingData } = await supabase
          .from("appointments")
          .select("id, start_at, end_at, status, modality, location, notes")
          .eq("patient_id", patientData.id)
          .gte("start_at", now)
          .order("start_at", { ascending: true });

        setUpcomingAppointments(upcomingData || []);

        const { data: pastData } = await supabase
          .from("appointments")
          .select("id, start_at, end_at, status, modality, location, notes")
          .eq("patient_id", patientData.id)
          .lt("start_at", now)
          .order("start_at", { ascending: false })
          .limit(10);

        setPastAppointments(pastData || []);

        // Load payments
        const { data: paymentsData } = await supabase
          .from("payments")
          .select("id, amount, currency, due_date, status, paid_at")
          .eq("patient_id", patientData.id)
          .order("due_date", { ascending: false })
          .limit(10);

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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendiente" },
      confirmed: { variant: "default", label: "Confirmada" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      completed: { variant: "outline", label: "Completada" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      paid: { variant: "default", label: "Pagado" },
      pending: { variant: "secondary", label: "Pendiente" },
      due_soon: { variant: "outline", label: "Por vencer" },
      overdue: { variant: "destructive", label: "Vencido" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const hasOverduePayments = payments.some(p => p.status === "overdue");

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
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
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold">Mi Portal</h1>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Patient Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Mis datos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">{patient?.full_name}</p>
            {patient?.email && (
              <p className="text-sm text-muted-foreground">{patient.email}</p>
            )}
            {patient?.whatsapp_phone && (
              <p className="text-sm text-muted-foreground">{patient.whatsapp_phone}</p>
            )}
            {patient?.reason_for_consultation && (
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">Motivo: </span>
                {patient.reason_for_consultation}
              </p>
            )}
            {patient?.created_at && (
              <p className="text-xs text-muted-foreground mt-2">
                Paciente desde {format(parseISO(patient.created_at), "MMMM yyyy", { locale: es })}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximas citas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenés próximas citas agendadas.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {format(parseISO(apt.start_at), "EEEE d 'de' MMMM", { locale: es })}
                      </span>
                      {getStatusBadge(apt.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")}
                    </p>
                    {apt.modality && (
                      <p className="text-sm text-muted-foreground capitalize">
                        Modalidad: {apt.modality}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Appointments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Historial de citas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pastAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tenés citas anteriores.</p>
            ) : (
              <div className="space-y-3">
                {pastAppointments.map((apt) => (
                  <div key={apt.id} className="border rounded-lg p-3 space-y-1 opacity-75">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {format(parseISO(apt.start_at), "d MMM yyyy", { locale: es })}
                      </span>
                      {getStatusBadge(apt.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(apt.start_at), "HH:mm")} - {format(parseISO(apt.end_at), "HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasOverduePayments && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-destructive font-medium">
                  Tenés pagos vencidos
                </p>
              </div>
            )}
            {!hasOverduePayments && payments.length > 0 && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-primary font-medium">
                  Al día con tus pagos
                </p>
              </div>
            )}
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay pagos registrados.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {format(parseISO(payment.due_date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    {getPaymentStatusBadge(payment.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default PatientPortal;
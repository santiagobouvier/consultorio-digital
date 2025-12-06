import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Calendar, FileText, CreditCard, Plus, Check } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { PaymentForm } from "@/components/PaymentForm";

interface Patient {
  id: string;
  business_id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  reason_for_consultation: string | null;
  private_notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  modality: string | null;
  source: string;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  paid_at: string | null;
}

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  attended: "Realizada",
  no_show: "No asistió",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  overdue: "Vencido",
  cancelled: "Cancelado",
};

const PatientDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Fetch patient
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (patientError) {
        console.error("Error fetching patient:", patientError);
        toast({
          title: "Error",
          description: "No se pudo cargar el paciente",
          variant: "destructive",
        });
        return;
      }

      if (!patientData) {
        setPatient(null);
        setLoading(false);
        return;
      }

      setPatient(patientData);

      // Fetch appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select("id, start_at, end_at, status, modality, source")
        .eq("patient_id", id)
        .order("start_at", { ascending: false });

      setAppointments(appointmentsData || []);

      // Fetch payments (defensively)
      try {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("payments")
          .select("id, amount, currency, due_date, status, paid_at")
          .eq("patient_id", id)
          .order("due_date", { ascending: false });

        if (paymentsError) {
          console.error("Error fetching payments:", paymentsError);
          setPaymentsError(true);
        } else {
          setPayments(paymentsData || []);
        }
      } catch {
        setPaymentsError(true);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar la información",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d MMM yyyy", { locale: es });
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "d MMM yyyy, HH:mm", { locale: es });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-UY", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from("payments")
        .update({ paid_at: new Date().toISOString(), status: "paid" })
        .eq("id", paymentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago marcado como pagado",
      });
      fetchData();
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el pago",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando información del paciente...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
        <p className="text-muted-foreground text-lg">Paciente no encontrado</p>
        <Link to="/patients">
          <Button variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al listado
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/patients")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
              {patient.full_name}
            </h1>
            <Badge
              variant={patient.is_active ? "default" : "secondary"}
              className="mt-1 rounded-full"
            >
              {patient.is_active ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>

        {/* Patient Info Card */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Información del paciente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="text-sm font-medium text-foreground">
                    {patient.email || "No registrado"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">WhatsApp</p>
                  <p className="text-sm font-medium text-foreground">
                    {patient.whatsapp_phone || "No registrado"}
                  </p>
                </div>
              </div>
            </div>

            {patient.reason_for_consultation && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Motivo de consulta
                </p>
                <p className="text-sm text-foreground">{patient.reason_for_consultation}</p>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Registrado el {formatDate(patient.created_at)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Section */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Citas del paciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Este paciente todavía no tiene citas registradas.
              </p>
            ) : (
              <div className="space-y-3">
                {appointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50"
                  >
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {formatDateTime(appointment.start_at)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {appointment.modality === "online" ? "Online" : "Presencial"}
                        </span>
                        {appointment.source && appointment.source !== "panel" && (
                          <span className="text-xs text-muted-foreground">
                            • Origen: {appointment.source}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={appointment.status === "attended" ? "default" : "secondary"}
                      className="rounded-full text-xs"
                    >
                      {statusLabels[appointment.status] || appointment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments Section */}
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Pagos y vencimientos
              </CardTitle>
              {!paymentsError && (
                <Button
                  onClick={() => setShowPaymentForm(true)}
                  className="rounded-xl h-10 px-4 font-semibold"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Registrar pago</span>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {paymentsError ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Pagos no disponibles en este momento.
              </p>
            ) : payments.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                Sin pagos registrados.
              </p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50"
                  >
                    <div>
                      <p className="font-bold text-foreground">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vence: {formatDate(payment.due_date)}
                      </p>
                      {payment.paid_at && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Pagado el {formatDate(payment.paid_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {payment.status !== "paid" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsPaid(payment.id)}
                          className="rounded-lg h-8 px-2"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Badge
                        variant={payment.status === "paid" ? "default" : "secondary"}
                        className={`rounded-full text-xs ${
                          payment.status === "overdue" ? "bg-destructive text-destructive-foreground" : ""
                        }`}
                      >
                        {paymentStatusLabels[payment.status] || payment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Form Modal */}
      {patient && (
        <PaymentForm
          open={showPaymentForm}
          onOpenChange={setShowPaymentForm}
          patientId={patient.id}
          businessId={patient.business_id}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default PatientDetail;

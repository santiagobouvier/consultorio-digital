import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Search, Filter, RefreshCw } from "lucide-react";
import { PaymentWhatsAppMenu } from "@/components/PaymentWhatsAppMenu";
import {
  calculatePaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  formatCurrency,
  getRecurrenceTypeLabel,
  type PaymentStatus,
  type RecurrenceType,
} from "@/lib/payments";

interface Patient {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
}

interface Payment {
  id: string;
  patient_id: string;
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  status: PaymentStatus;
  recurrence_type: RecurrenceType;
  patients?: {
    full_name: string;
    whatsapp_phone: string | null;
  };
}

const Payments = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [patientFilter, setPatientFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) {
        navigate("/configurar-negocio");
        return;
      }

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*, recurrence_type, anchor_day")
        .eq("business_id", business.id)
        .order("due_date", { ascending: true });

      if (paymentsError) throw paymentsError;

      // Fetch patients for filter and to map names
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, full_name, whatsapp_phone")
        .eq("business_id", business.id)
        .order("full_name");

      const patientsMap = new Map(
        (patientsData || []).map((p) => [p.id, { full_name: p.full_name, whatsapp_phone: p.whatsapp_phone }])
      );

      // Calculate real-time status and add patient name
      const paymentsWithStatus = (paymentsData || []).map((payment) => ({
        ...payment,
        status: calculatePaymentStatus(payment),
        recurrence_type: (payment.recurrence_type || 'one_time') as RecurrenceType,
        patients: patientsMap.get(payment.patient_id) || { full_name: "Desconocido", whatsapp_phone: null },
      })) as Payment[];

      setPayments(paymentsWithStatus);
      setPatients(
        (patientsData || []).filter((p) => p.full_name) as Patient[]
      );
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const filteredPayments = payments.filter((payment) => {
    // Status filter
    if (statusFilter !== "all" && payment.status !== statusFilter) {
      return false;
    }

    // Patient filter
    if (patientFilter !== "all" && payment.patient_id !== patientFilter) {
      return false;
    }

    // Search query (patient name)
    if (searchQuery) {
      const patientName = payment.patients?.full_name?.toLowerCase() || "";
      if (!patientName.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Pagos
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona los pagos de tus pacientes
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mobile-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Filtros</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="overdue">Vencidos</SelectItem>
                  <SelectItem value="due_soon">Por vencer</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="paid">Pagados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>

              {/* Patient Filter */}
              <Select value={patientFilter} onValueChange={setPatientFilter}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Paciente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los pacientes</SelectItem>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Payments List */}
        <Card className="mobile-card">
          <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
            <CardTitle className="text-lg font-bold">
              {filteredPayments.length} pago{filteredPayments.length !== 1 && "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
            {filteredPayments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                No se encontraron pagos
              </p>
            ) : (
              <div className="space-y-2">
                {filteredPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => navigate(`/patients/${payment.patient_id}`)}
                        className="font-semibold text-sm text-foreground hover:text-primary transition-colors text-left truncate block w-full"
                      >
                        {payment.patients?.full_name || "Paciente desconocido"}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">
                          Vence: {format(new Date(payment.due_date), "d MMM yyyy", { locale: es })}
                        </p>
                        {payment.recurrence_type !== "one_time" && (
                          <Badge variant="outline" className="rounded-full text-[10px] gap-0.5 h-5">
                            <RefreshCw className="h-2.5 w-2.5" />
                            {getRecurrenceTypeLabel(payment.recurrence_type)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {payment.status !== "paid" && payment.status !== "cancelled" && (
                        <PaymentWhatsAppMenu
                          patientPhone={payment.patients?.whatsapp_phone || null}
                          patientName={payment.patients?.full_name || ""}
                        />
                      )}
                      <span className="font-bold text-sm text-foreground">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <Badge className={`${getPaymentStatusColor(payment.status)} rounded-full text-xs`}>
                        {getPaymentStatusLabel(payment.status)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Payments;
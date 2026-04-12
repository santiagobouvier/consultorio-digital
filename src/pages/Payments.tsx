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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Search, Filter, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { PaymentWhatsAppMenu } from "@/components/PaymentWhatsAppMenu";
import { PaymentForm } from "@/components/PaymentForm";
import { ConfirmPaymentDialog } from "@/components/ConfirmPaymentDialog";
import LoadingPage from "@/components/LoadingPage";
import { PaymentDetailDrawer } from "@/components/PaymentDetailDrawer";
import {
  calculatePaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  formatCurrency,
  getRecurrenceTypeLabel,
  type PaymentStatus,
  type RecurrenceType,
} from "@/lib/payments";
import { useBusinessId } from "@/hooks/use-business-id";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";


interface Patient {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
}

interface Payment {
  id: string;
  patient_id: string;
  business_id: string;
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  status: PaymentStatus;
  recurrence_type: RecurrenceType;
  anchor_day: number | null;
  method: string | null;
  notes: string | null;
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
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    searchParams.get("status") || "all"
  );
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [confirmPaymentData, setConfirmPaymentData] = useState<{ id: string; amount: number; patientName: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const { businessId, loading: businessLoading } = useBusinessId();
  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) {
      setStatusFilter(status);
    }
  }, [searchParams]);

  const fetchData = async () => {
    if (!businessId) return;
    
    try {
      setDataLoading(true);

      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*, recurrence_type, anchor_day, method, notes")
        .eq("business_id", businessId)
        .order("due_date", { ascending: true });

      if (paymentsError) throw paymentsError;

      // Fetch patients for filter and to map names
      const { data: patientsData } = await supabase
        .from("patients")
        .select("id, full_name, whatsapp_phone")
        .eq("business_id", businessId)
        .order("full_name");

      const patientsMap = new Map(
        (patientsData || []).map((p) => [p.id, { full_name: p.full_name, whatsapp_phone: p.whatsapp_phone }])
      );

      // Calculate real-time status and add patient name
      const paymentsWithStatus = (paymentsData || []).map((payment) => ({
        ...payment,
        status: calculatePaymentStatus(payment),
        recurrence_type: (payment.recurrence_type || 'one_time') as RecurrenceType,
        business_id: businessId,
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
      setDataLoading(false);
    }
  };

  const loading = businessLoading || dataLoading;

  const handleDeletePayment = async () => {
    if (!deletingPaymentId) return;
    
    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", deletingPaymentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago eliminado correctamente",
      });
      setDeletingPaymentId(null);
      fetchData();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el pago",
        variant: "destructive",
      });
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
    return <LoadingPage />;
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
                    onClick={() => setSelectedPayment(payment)}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3 cursor-pointer active:bg-muted/50 transition-colors rounded-lg -mx-2 px-2"
                  >
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patients/${payment.patient_id}`);
                        }}
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
                        <div onClick={(e) => e.stopPropagation()}>
                          <PaymentWhatsAppMenu
                            patientPhone={payment.patients?.whatsapp_phone || null}
                            patientName={payment.patients?.full_name || ""}
                          />
                        </div>
                      )}
                      <span className="font-bold text-sm text-foreground">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <Badge className={`${getPaymentStatusColor(payment.status)} rounded-full text-xs`}>
                        {getPaymentStatusLabel(payment.status)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPayment(payment);
                        }}
                        className="rounded-lg h-8 px-2"
                        title="Editar pago"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingPaymentId(payment.id);
                        }}
                        className="rounded-lg h-8 px-2 text-destructive hover:text-destructive"
                        title="Eliminar pago"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {editingPayment && businessId && (
        <PaymentForm
          open={!!editingPayment}
          onOpenChange={(open) => !open && setEditingPayment(null)}
          patientId={editingPayment.patient_id}
          businessId={businessId}
          paymentId={editingPayment.id}
          initialData={{
            amount: editingPayment.amount,
            due_date: editingPayment.due_date,
            method: editingPayment.method,
            notes: editingPayment.notes,
            recurrence_type: editingPayment.recurrence_type,
            anchor_day: editingPayment.anchor_day,
          }}
          onSuccess={() => {
            setEditingPayment(null);
            fetchData();
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingPaymentId} onOpenChange={(open) => !open && setDeletingPaymentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pago será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePayment} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Detail Drawer */}
      <PaymentDetailDrawer
        open={!!selectedPayment}
        onOpenChange={(open) => !open && setSelectedPayment(null)}
        payment={selectedPayment}
        onEdit={() => {
          if (selectedPayment) {
            setEditingPayment(selectedPayment);
          }
        }}
        onMarkAsPaid={() => {
          if (selectedPayment) {
            setConfirmPaymentData({
              id: selectedPayment.id,
              amount: selectedPayment.amount,
              patientName: selectedPayment.patients?.full_name || "Paciente",
            });
          }
        }}
      />

      {confirmPaymentData && (
        <ConfirmPaymentDialog
          open={!!confirmPaymentData}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setConfirmPaymentData(null);
              setSelectedPayment(null);
            }
          }}
          patientName={confirmPaymentData.patientName}
          amount={confirmPaymentData.amount}
          onConfirm={async () => {
            const { error } = await supabase
              .from("payments")
              .update({ paid_at: new Date().toISOString(), status: "paid" })
              .eq("id", confirmPaymentData.id);
            if (error) throw error;
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default Payments;
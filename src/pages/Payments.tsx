import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HelpTooltip } from "@/components/HelpTooltip";
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
import {
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  Receipt,
  Plus,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
} from "lucide-react";
import { exportCSV, todayDateString } from "@/lib/csv-export";
import { PaymentWhatsAppMenu } from "@/components/PaymentWhatsAppMenu";
import { PaymentForm } from "@/components/PaymentForm";
import { GlobalPaymentForm } from "@/components/GlobalPaymentForm";
import { ConfirmPaymentDialog } from "@/components/ConfirmPaymentDialog";
import { RouteSkeleton } from "@/components/RouteSkeleton";
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
import { cn } from "@/lib/utils";

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
  const queryClient = useQueryClient();
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
  const [showNewPayment, setShowNewPayment] = useState(false);

  const { businessId, loading: businessLoading } = useBusinessId();

  // Main payments query — key matches query-prefetch.ts
  const { data: rawPayments = [], isLoading: paymentsLoading, error: paymentsError, refetch: refetchPayments } = useQuery({
    queryKey: ["payments", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, patients(full_name, whatsapp_phone)")
        .eq("business_id", businessId!)
        .order("due_date", { ascending: false })
        .limit(200);
      if (error) {
        console.error("Error fetching payments:", error);
        throw error;
      }
      return data ?? [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  // Patients list for filter dropdown
  const { data: patients = [] } = useQuery({
    queryKey: ["patients_list_for_payments", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name, whatsapp_phone")
        .eq("business_id", businessId!)
        .order("full_name");
      return (data || []).filter((p) => p.full_name) as Patient[];
    },
    enabled: !!businessId,
    staleTime: 60_000,
  });

  // Transform raw payments to include calculated status
  const payments = useMemo(() => {
    return rawPayments.map((payment: any) => ({
      ...payment,
      status: calculatePaymentStatus(payment),
      recurrence_type: (payment.recurrence_type || "one_time") as RecurrenceType,
      business_id: businessId!,
      patients: payment.patients || { full_name: "Desconocido", whatsapp_phone: null },
    })) as Payment[];
  }, [rawPayments, businessId]);

  const invalidatePayments = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["payments", businessId] });
  }, [queryClient, businessId]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) setStatusFilter(status);
    setCurrentPage(1);
  }, [searchParams, searchQuery, statusFilter, patientFilter]);


  const handleDeletePayment = async () => {
    if (!deletingPaymentId) return;
    try {
      const { error } = await supabase.from("payments").delete().eq("id", deletingPaymentId);
      if (error) throw error;
      toast({ title: "Éxito", description: "Pago eliminado correctamente" });
      setDeletingPaymentId(null);
      invalidatePayments();
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast({ title: "Error", description: "No se pudo eliminar el pago", variant: "destructive" });
    }
  };

  const filteredPayments = payments.filter((payment) => {
    if (statusFilter !== "all" && payment.status !== statusFilter) return false;
    if (patientFilter !== "all" && payment.patient_id !== patientFilter) return false;
    if (searchQuery) {
      const patientName = payment.patients?.full_name?.toLowerCase() || "";
      if (!patientName.includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  // Orden por urgencia: vencidos primero (la deuda más vieja arriba), después
  // por vencer y pendientes por fecha, lo pagado al final (reciente primero).
  const STATUS_PRIORITY: Record<PaymentStatus, number> = {
    overdue: 0, due_soon: 1, pending: 2, paid: 3, cancelled: 4,
  };
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    const pa = STATUS_PRIORITY[a.status];
    const pb = STATUS_PRIORITY[b.status];
    if (pa !== pb) return pa - pb;
    if (a.status === "paid") return (b.paid_at || "").localeCompare(a.paid_at || "");
    if (a.status === "cancelled") return b.due_date.localeCompare(a.due_date);
    return a.due_date.localeCompare(b.due_date);
  });

  // Números del mes en curso (lo cancelado no cuenta)
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMonth = (d: string | null) => !!d && new Date(d) >= monthStart;
    const active = payments.filter((p) => p.status !== "cancelled");
    const totalAmount = active.filter((p) => inMonth(p.due_date)).reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = active.filter((p) => p.paid_at && inMonth(p.paid_at)).reduce((sum, p) => sum + p.amount, 0);
    const overdueCount = payments.filter((p) => p.status === "overdue").length;
    const pendingCount = payments.filter((p) => p.status === "pending" || p.status === "due_soon").length;
    return { totalAmount, paidAmount, overdueCount, pendingCount };
  }, [payments]);

  // Deudores: pagos vencidos agrupados por paciente, el que más debe primero
  const debtors = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; total: number; count: number }>();
    for (const p of payments) {
      if (p.status !== "overdue") continue;
      const cur = map.get(p.patient_id) ?? {
        name: p.patients?.full_name || "Paciente",
        phone: p.patients?.whatsapp_phone || null,
        total: 0,
        count: 0,
      };
      cur.total += p.amount;
      cur.count += 1;
      map.set(p.patient_id, cur);
    }
    return Array.from(map.entries())
      .map(([patientId, d]) => ({ patientId, ...d }))
      .sort((a, b) => b.total - a.total);
  }, [payments]);

  const { paginatedItems: pagePayments, totalPages } = usePagination(sortedPayments, currentPage);

  if (!businessId && businessLoading) return <RouteSkeleton />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Hero Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
            <Receipt className="h-3.5 w-3.5" />
            Gestión financiera
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            <span className="inline-flex items-center gap-2">
              Pagos
              <HelpTooltip id="payments" />
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {filteredPayments.length} pago{filteredPayments.length !== 1 ? "s" : ""} registrado{filteredPayments.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Facturado (mes)",
              value: formatCurrency(stats.totalAmount, "UYU"),
              icon: DollarSign,
              color: "text-primary",
              bg: "bg-primary/10",
              helpId: "paymentsTotalBilled" as const,
            },
            {
              label: "Cobrado (mes)",
              value: formatCurrency(stats.paidAmount, "UYU"),
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
              helpId: "paymentsTotalCollected" as const,
            },
            {
              label: "Vencidos",
              value: stats.overdueCount.toString(),
              icon: AlertTriangle,
              color: "text-destructive",
              bg: "bg-destructive/10",
              helpId: "paymentsOverdueCount" as const,
            },
            {
              label: "Pendientes",
              value: stats.pendingCount.toString(),
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
              helpId: "paymentsPendingCount" as const,
            },
          ].map((stat, i) => (
            <Card
              key={stat.label}
              className="border-border/50 shadow-sm hover:shadow-md transition-shadow animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg sm:text-xl font-bold text-foreground leading-none truncate">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                    {stat.label}
                    <HelpTooltip id={stat.helpId} />
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-2xl text-base bg-card border-border/50 shadow-sm focus-visible:ring-primary/30 focus-visible:border-primary/50"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-2xl border-border/50 shadow-sm bg-card">
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
          <Select value={patientFilter} onValueChange={setPatientFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-2xl border-border/50 shadow-sm bg-card">
              <SelectValue placeholder="Paciente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            className="h-12 rounded-2xl border-border/50 shadow-sm bg-card gap-2"
            onClick={() => {
              const headers = ["Paciente", "Monto (UYU)", "Fecha de vencimiento", "Fecha de pago", "Estado", "Método de pago", "Tipo de recurrencia"];
              const rows = filteredPayments.map((p) => [
                p.patients?.full_name || "Desconocido",
                `${p.amount}`,
                new Date(p.due_date).toLocaleDateString("es-UY"),
                p.paid_at ? new Date(p.paid_at).toLocaleDateString("es-UY") : "",
                getPaymentStatusLabel(p.status),
                p.method || "",
                getRecurrenceTypeLabel(p.recurrence_type),
              ]);
              exportCSV(headers, rows, `pagos_${todayDateString()}.csv`);
            }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
        </div>

        {/* Deudores: siempre a la vista, el que más debe primero */}
        {debtors.length > 0 && statusFilter !== "paid" && statusFilter !== "cancelled" && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-semibold text-sm inline-flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Te deben {formatCurrency(debtors.reduce((s, d) => s + d.total, 0), "UYU")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {debtors.length} paciente{debtors.length !== 1 ? "s" : ""} con pagos vencidos
                </p>
              </div>
              <div className="space-y-1.5">
                {debtors.slice(0, 5).map((d) => (
                  <div
                    key={d.patientId}
                    className="flex items-center justify-between gap-3 rounded-lg bg-background/60 border border-border/50 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPatientFilter(d.patientId);
                        setStatusFilter("overdue");
                      }}
                      className="text-sm font-medium text-left truncate hover:text-primary transition-colors"
                      title="Ver sus pagos vencidos"
                    >
                      {d.name}
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        {d.count} pago{d.count !== 1 ? "s" : ""}
                      </span>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-sm text-destructive">
                        {formatCurrency(d.total, "UYU")}
                      </span>
                      <PaymentWhatsAppMenu patientPhone={d.phone} patientName={d.name} />
                    </div>
                  </div>
                ))}
                {debtors.length > 5 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("overdue")}
                    className="text-xs text-muted-foreground hover:text-foreground px-1"
                  >
                    Ver los {debtors.length - 5} restantes…
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment List */}
        {paymentsError ? (
          <Card className="border-2 border-destructive/40 bg-destructive/5">
            <CardContent className="py-12 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-destructive">No se pudieron cargar los pagos</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {(paymentsError as any)?.message || "Ocurrió un error al consultar la base de datos. Verificá tu conexión y volvé a intentar."}
                </p>
              </div>
              <Button variant="outline" onClick={() => refetchPayments()} className="rounded-xl gap-2">
                <RefreshCw className="h-4 w-4" />
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : paymentsLoading ? (
          <Card className="border-border/50">
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">Cargando pagos...</p>
            </CardContent>
          </Card>
        ) : filteredPayments.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-16 text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">No se encontraron pagos</p>
              <p className="text-sm text-muted-foreground/70">Ajustá los filtros o registrá un nuevo pago</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pagePayments.map((payment, index) => (
              <Card
                key={payment.id}
                onClick={() => setSelectedPayment(payment)}
                className="group cursor-pointer border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Status Indicator */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      payment.status === "paid"
                        ? "bg-emerald-500/10"
                        : payment.status === "overdue"
                        ? "bg-destructive/10"
                        : payment.status === "due_soon"
                        ? "bg-amber-500/10"
                        : "bg-muted"
                    )}
                  >
                    {payment.status === "paid" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : payment.status === "overdue" ? (
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>

                  {/* Info */}
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

                  {/* Actions */}
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
                    {payment.status !== "paid" && payment.status !== "cancelled" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmPaymentData({
                            id: payment.id,
                            amount: payment.amount,
                            patientName: payment.patients?.full_name || "Paciente",
                          });
                        }}
                        className="rounded-lg h-8 gap-1.5"
                        title="Marcar como pagado"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Cobrar</span>
                      </Button>
                    )}
                    <div className="hidden sm:flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPayment(payment);
                        }}
                        className="rounded-lg h-8 px-2 text-foreground"
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={filteredPayments.length}
          pageSize={ITEMS_PER_PAGE}
        />
      </div>

      {/* FAB - New Payment */}
      <button
        onClick={() => setShowNewPayment(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-200 flex items-center justify-center"
        style={{
          boxShadow: "0 8px 25px -5px hsl(var(--primary) / 0.4)",
        }}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* New Payment Form */}
      {businessId && (
        <GlobalPaymentForm
          open={showNewPayment}
          onOpenChange={setShowNewPayment}
          businessId={businessId}
          onSuccess={() => {
            setShowNewPayment(false);
            invalidatePayments();
          }}
        />
      )}

      {/* Edit Payment Form */}
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
            invalidatePayments();
          }}
        />
      )}

      {/* Delete Confirmation */}
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
          if (selectedPayment) setEditingPayment(selectedPayment);
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
              invalidatePayments();
          }}
        />
      )}
    </div>
  );
};

export default Payments;

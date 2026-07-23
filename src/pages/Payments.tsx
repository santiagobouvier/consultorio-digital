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
  MoreVertical,
} from "lucide-react";
import { exportCSV, todayDateString } from "@/lib/csv-export";
import { createPaymentLink } from "@/lib/payment-links";
import { invalidatePaymentData } from "@/lib/data-sync";
import { PaymentWhatsAppMenu } from "@/components/PaymentWhatsAppMenu";
import { PaymentLinkMenu } from "@/components/PaymentLinkMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  mp_link_url?: string | null;
  mp_link_status?: string | null;
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
  // Período: preset o rango personalizado (sobre la fecha de vencimiento;
  // "Cobrado" usa la fecha de pago dentro del mismo rango)
  const [periodFilter, setPeriodFilter] = useState<string>(
    searchParams.get("period") || "all"
  );
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
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

  // ¿El consultorio tiene Mercado Pago conectado? (habilita links de cobro)
  const { data: mpConnected = false } = useQuery({
    queryKey: ["mp_connected", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_policies")
        .select("mp_access_token")
        .eq("business_id", businessId!)
        .maybeSingle();
      return !!(data as any)?.mp_access_token;
    },
    enabled: !!businessId,
    staleTime: 300_000,
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
    // Central: refresca Pagos, los chips de la agenda y la ficha del paciente
    invalidatePaymentData(queryClient);
  }, [queryClient]);

  // Link de cobro MP: siempre pasa por el backend, que actualiza la
  // preferencia existente (misma URL, monto vigente) o crea una nueva.
  const ensurePaymentLink = useCallback(async (ids: string[]) => {
    const url = await createPaymentLink(businessId!, ids);
    invalidatePayments();
    return url;
  }, [businessId, invalidatePayments]);

  useEffect(() => {
    const status = searchParams.get("status");
    if (status) setStatusFilter(status);
    setCurrentPage(1);
  }, [searchParams, searchQuery, statusFilter, patientFilter, periodFilter, customFrom, customTo]);


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

  // Rango de fechas del período elegido ([desde, hasta], null = sin límite)
  const periodRange = useMemo((): { from: Date | null; to: Date | null } => {
    const now = new Date();
    switch (periodFilter) {
      case "this_month":
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
      case "last_month":
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
        };
      case "30d":
        return { from: new Date(now.getTime() - 30 * 86400000), to: null };
      case "this_year":
        return { from: new Date(now.getFullYear(), 0, 1), to: null };
      case "custom":
        return {
          from: customFrom ? new Date(customFrom + "T00:00:00") : null,
          to: customTo ? new Date(customTo + "T23:59:59.999") : null,
        };
      default:
        return { from: null, to: null };
    }
  }, [periodFilter, customFrom, customTo]);

  const rangeActive = !!(periodRange.from || periodRange.to);
  const inPeriod = useCallback(
    (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (periodRange.from && d < periodRange.from) return false;
      if (periodRange.to && d > periodRange.to) return false;
      return true;
    },
    [periodRange]
  );

  const filteredPayments = payments.filter((payment) => {
    if (statusFilter !== "all" && payment.status !== statusFilter) return false;
    if (patientFilter !== "all" && payment.patient_id !== patientFilter) return false;
    // Período: los pagos COBRADOS se ubican por su fecha de pago (así
    // "cobrado este mes" muestra lo que entró este mes, aunque la deuda
    // venciera antes); el resto, por su vencimiento.
    const refDate = payment.status === "paid" && payment.paid_at ? payment.paid_at : payment.due_date;
    if (rangeActive && !inPeriod(refDate)) return false;
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

  // Números: del período elegido; sin período, del mes en curso.
  // Lo cancelado no cuenta. Vencidos/pendientes son de HOY, no del período.
  const stats = useMemo(() => {
    const now = new Date();
    const from = rangeActive ? periodRange.from : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = rangeActive ? periodRange.to : null;
    const within = (iso: string | null) => {
      if (!iso) return false;
      const d = new Date(iso);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const active = payments.filter((p) => p.status !== "cancelled");
    const totalAmount = active.filter((p) => within(p.due_date)).reduce((sum, p) => sum + p.amount, 0);
    const paidAmount = active.filter((p) => within(p.paid_at)).reduce((sum, p) => sum + p.amount, 0);
    const overdueCount = payments.filter((p) => p.status === "overdue").length;
    const pendingCount = payments.filter((p) => p.status === "pending" || p.status === "due_soon").length;
    return { totalAmount, paidAmount, overdueCount, pendingCount };
  }, [payments, rangeActive, periodRange]);

  // Deudores: pagos vencidos agrupados por paciente, el que más debe primero
  const debtors = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; total: number; count: number; ids: string[] }>();
    for (const p of payments) {
      if (p.status !== "overdue") continue;
      const cur = map.get(p.patient_id) ?? {
        name: p.patients?.full_name || "Paciente",
        phone: p.patients?.whatsapp_phone || null,
        total: 0,
        count: 0,
        ids: [] as string[],
      };
      cur.total += p.amount;
      cur.count += 1;
      cur.ids.push(p.id);
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
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">

        {/* Encabezado de página */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsla(152, 70%, 45%, 0.14)" }}>
              <Receipt className="h-5 w-5" style={{ color: "hsl(152 70% 45%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
                Pagos
                <HelpTooltip id="payments" />
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredPayments.length} pago{filteredPayments.length !== 1 ? "s" : ""} en la vista
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNewPayment(true)} className="hidden sm:inline-flex gap-2 rounded-xl h-11 px-5 font-semibold shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            Registrar pago
          </Button>
        </div>

        {/* Stats Row: cada tarjeta también FILTRA la lista */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: rangeActive ? "Facturado (período)" : "Facturado (mes)",
              value: formatCurrency(stats.totalAmount, "UYU"),
              icon: DollarSign,
              color: "text-primary",
              bg: "bg-primary/10",
              helpId: "paymentsTotalBilled" as const,
              filter: "all",
            },
            {
              label: rangeActive ? "Cobrado (período)" : "Cobrado (mes)",
              value: formatCurrency(stats.paidAmount, "UYU"),
              icon: CheckCircle2,
              color: "text-emerald-600",
              bg: "bg-emerald-500/10",
              helpId: "paymentsTotalCollected" as const,
              filter: "paid",
            },
            {
              label: "Vencidos",
              value: stats.overdueCount.toString(),
              icon: AlertTriangle,
              color: "text-destructive",
              bg: "bg-destructive/10",
              helpId: "paymentsOverdueCount" as const,
              filter: "overdue",
            },
            {
              label: "Pendientes",
              value: stats.pendingCount.toString(),
              icon: Clock,
              color: "text-amber-600",
              bg: "bg-amber-500/10",
              helpId: "paymentsPendingCount" as const,
              filter: "pending",
            },
          ].map((stat, i) => (
            <Card
              key={stat.label}
              onClick={() => setStatusFilter(stat.filter)}
              className={cn(
                "border-border/50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer animate-fade-in",
                statusFilter === stat.filter && "ring-2 ring-primary/40 border-primary/30"
              )}
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
          {/* En mobile: grilla 2x2 compacta; en escritorio se disuelve (sm:contents)
              y los controles quedan en la misma fila que el buscador */}
          <div className="grid grid-cols-2 gap-2 sm:contents">
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
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-2xl border-border/50 shadow-sm bg-card">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el historial</SelectItem>
              <SelectItem value="this_month">Este mes</SelectItem>
              <SelectItem value="last_month">Mes pasado</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="this_year">Este año</SelectItem>
              <SelectItem value="custom">Personalizado…</SelectItem>
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
            <span className="sm:hidden">CSV</span>
            <span className="hidden sm:inline">Exportar CSV</span>
          </Button>
          </div>
        </div>

        {/* Rango personalizado */}
        {periodFilter === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground w-14 shrink-0">Desde</span>
              <Input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-11 rounded-2xl border-border/50 bg-card"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-muted-foreground w-14 shrink-0">Hasta</span>
              <Input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-11 rounded-2xl border-border/50 bg-card"
              />
            </div>
          </div>
        )}

        {/* Layout desktop: lista (2/3) + panel lateral con deudores y cobranza */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="space-y-4 lg:order-2">
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
                      <PaymentLinkMenu
                        compact
                        patientPhone={d.phone}
                        patientName={d.name}
                        getPaymentLink={mpConnected && d.ids.length > 0 ? () => ensurePaymentLink(d.ids) : undefined}
                      />
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

        {/* Tasa de cobranza del período */}
        {(stats.totalAmount > 0 || stats.paidAmount > 0) && (
          <Card className="hidden lg:block border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tasa de cobranza {rangeActive ? "del período" : "del mes"}
              </p>
              {(() => {
                const rate = stats.totalAmount > 0
                  ? Math.min(100, Math.round((stats.paidAmount / stats.totalAmount) * 100))
                  : 100;
                return (
                  <>
                    <div className="flex items-end justify-between">
                      <span className="text-3xl font-bold text-foreground tabular-nums leading-none">{rate}<span className="text-base text-muted-foreground font-medium">%</span></span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(stats.paidAmount, "UYU")} de {formatCurrency(stats.totalAmount, "UYU")}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-700",
                          rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-destructive"
                        )}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        )}
        </div>

        {/* Columna principal: lista de pagos */}
        <div className="space-y-4 lg:order-1 lg:col-span-2">
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
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 sm:gap-4">
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

                    {/* Monto + estado: columna derecha, respira en cualquier ancho */}
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[15px] text-foreground leading-tight">
                        {formatCurrency(payment.amount, payment.currency)}
                      </p>
                      <Badge className={`${getPaymentStatusColor(payment.status)} rounded-full text-[11px] mt-1`}>
                        {getPaymentStatusLabel(payment.status)}
                      </Badge>
                      {/* Estado del link de cobro online */}
                      {payment.status !== "paid" && payment.status !== "cancelled" && payment.mp_link_status === "rejected" && (
                        <p className="text-[10px] text-destructive mt-0.5 font-medium">Intentó pagar · rechazado</p>
                      )}
                      {payment.status !== "paid" && payment.status !== "cancelled" && payment.mp_link_status === "in_process" && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Pago online en proceso</p>
                      )}
                      {payment.status !== "paid" && payment.status !== "cancelled" && payment.mp_link_url && payment.mp_link_status === "created" && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">Link de pago enviado</p>
                      )}
                    </div>

                    {/* Acciones inline: solo escritorio. Cobro online, aviso y
                        cobrar manual visibles; editar/eliminar guardados en ⋯ */}
                    <div
                      className="hidden sm:flex items-center gap-1.5 shrink-0 pl-2 ml-1 border-l border-border/40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {payment.status !== "paid" && payment.status !== "cancelled" && (
                        <>
                          <PaymentLinkMenu
                            patientPhone={payment.patients?.whatsapp_phone || null}
                            patientName={payment.patients?.full_name || ""}
                            getPaymentLink={mpConnected ? () => ensurePaymentLink([payment.id]) : undefined}
                          />
                          <PaymentWhatsAppMenu
                            patientPhone={payment.patients?.whatsapp_phone || null}
                            patientName={payment.patients?.full_name || ""}
                            getPaymentLink={mpConnected ? () => ensurePaymentLink([payment.id]) : undefined}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setConfirmPaymentData({
                                id: payment.id,
                                amount: payment.amount,
                                patientName: payment.patients?.full_name || "Paciente",
                              })
                            }
                            className="rounded-lg h-8 gap-1.5"
                            title="Marcar como pagado"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Cobrar</span>
                          </Button>
                        </>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg h-8 w-8 p-0 text-muted-foreground"
                            title="Más acciones"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => setEditingPayment(payment)} className="gap-2">
                            <Pencil className="h-4 w-4" />
                            Editar pago
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingPaymentId(payment.id)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar pago
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Acciones mobile: barra cómoda abajo, solo si hay algo por cobrar */}
                  {payment.status !== "paid" && payment.status !== "cancelled" && (
                    <div
                      className="flex sm:hidden items-center gap-2 mt-3 pt-3 border-t border-border/40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PaymentLinkMenu
                        patientPhone={payment.patients?.whatsapp_phone || null}
                        patientName={payment.patients?.full_name || ""}
                        getPaymentLink={mpConnected ? () => ensurePaymentLink([payment.id]) : undefined}
                      />
                      <PaymentWhatsAppMenu
                        patientPhone={payment.patients?.whatsapp_phone || null}
                        patientName={payment.patients?.full_name || ""}
                        getPaymentLink={mpConnected ? () => ensurePaymentLink([payment.id]) : undefined}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          setConfirmPaymentData({
                            id: payment.id,
                            amount: payment.amount,
                            patientName: payment.patients?.full_name || "Paciente",
                          })
                        }
                        className="flex-1 h-10 rounded-xl gap-2"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Cobrar
                      </Button>
                    </div>
                  )}
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
        </div>
      </div>

      {/* FAB - New Payment (solo mobile; en desktop está en el encabezado) */}
      <button
        onClick={() => setShowNewPayment(true)}
        className="sm:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-200 flex items-center justify-center"
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

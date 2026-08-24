// Panel de cuidado de pacientes: la página responde "¿cómo están mis
// pacientes y quién necesita mi atención?" — no es una lista de contactos.
// Segmentos que responden preguntas reales (sin próxima cita, con deuda),
// tarjetas con la historia de cada uno y WhatsApp de reenganche a un toque.
import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PatientForm } from "@/components/PatientForm";
import {
  Search, Plus, ChevronRight, Smartphone, Users, Download,
  User as UserIcon, MessageCircle, CalendarClock, AlertTriangle,
} from "lucide-react";
import { exportCSV, todayDateString } from "@/lib/csv-export";
import { useBusinessId } from "@/hooks/use-business-id";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { cn } from "@/lib/utils";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HelpTooltip } from "@/components/HelpTooltip";
import { openWhatsApp } from "@/lib/whatsapp";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { computeAge } from "@/lib/patient-profile";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";

interface Patient {
  id: string;
  full_name: string;
  email: string | null;
  whatsapp_phone: string | null;
  is_active: boolean;
  auth_user_id: string | null;
  avatar_url: string | null;
  birth_date?: string | null;
  created_at?: string;
  last_appointment?: string | null;
  next_appointment?: string | null;
}

interface DebtInfo {
  total: number;
  currency: string;
  overdue: boolean;
}

type Segment = "all" | "active" | "no_next" | "debt" | "portal" | "inactive";

// Un paciente activo sin próxima cita recién "preocupa" pasados unos días
// de su última sesión (si vino ayer, es normal que aún no agendó).
const LAPSED_AFTER_DAYS = 10;

const Patients = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [segment, setSegment] = useState<Segment>(() =>
    searchParams.get("portal") === "true" ? "portal" : "all"
  );
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { businessId, loading: businessLoading } = useBusinessId();

  // Main patients query — key matches query-prefetch.ts so prefetched data is used instantly
  const { data: patients = [], isLoading: dataLoading } = useQuery({
    queryKey: ["patients", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("business_id", businessId!)
        .order("full_name", { ascending: true });
      return (data ?? []) as Patient[];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    gcTime: 300_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidate cache on changes
  useEffect(() => {
    if (!businessId) return;
    const channel = supabase
      .channel(`patients-list-${businessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patients", filter: `business_id=eq.${businessId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["patients", businessId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);

  // Última / próxima cita por paciente
  const { data: enrichedPatients = [] } = useQuery({
    queryKey: ["patients_appointments", businessId],
    queryFn: async () => {
      if (!patients.length) return patients;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();
      const patientIds = patients.map(p => p.id);

      const [{ data: lastAppts }, { data: nextAppts }] = await Promise.all([
        supabase
          .from("appointments")
          .select("patient_id, start_at")
          .in("patient_id", patientIds)
          .eq("status", "attended")
          .lt("start_at", todayISO)
          .order("start_at", { ascending: false }),
        supabase
          .from("appointments")
          .select("patient_id, start_at")
          .in("patient_id", patientIds)
          .not("status", "in", '("cancelled","no_show")')
          .gte("start_at", todayISO)
          .order("start_at", { ascending: true }),
      ]);

      const lastMap = new Map<string, string>();
      for (const a of lastAppts || []) {
        if (a.patient_id && !lastMap.has(a.patient_id)) lastMap.set(a.patient_id, a.start_at);
      }
      const nextMap = new Map<string, string>();
      for (const a of nextAppts || []) {
        if (a.patient_id && !nextMap.has(a.patient_id)) nextMap.set(a.patient_id, a.start_at);
      }

      return patients.map(p => ({
        ...p,
        last_appointment: lastMap.get(p.id) || null,
        next_appointment: nextMap.get(p.id) || null,
      }));
    },
    enabled: !!businessId && patients.length > 0,
    staleTime: 30_000,
  });

  // Deuda por paciente (pagos sin cobrar, no cancelados)
  const { data: debtByPatient = new Map<string, DebtInfo>() } = useQuery({
    queryKey: ["patients_debts", businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("patient_id, amount, currency, due_date, status, paid_at")
        .eq("business_id", businessId!)
        .is("paid_at", null)
        .neq("status", "cancelled");
      const map = new Map<string, DebtInfo>();
      for (const p of data || []) {
        if (!p.patient_id) continue;
        const st = calculatePaymentStatus({
          due_date: p.due_date,
          paid_at: p.paid_at,
          status: p.status,
        });
        // Solo cuenta como deuda lo vencido o por vencer YA (no cuotas futuras lejanas)
        const cur = map.get(p.patient_id) ?? { total: 0, currency: p.currency, overdue: false };
        if (st === "overdue") {
          cur.total += Number(p.amount);
          cur.overdue = true;
          map.set(p.patient_id, cur);
        }
      }
      return map;
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });

  const displayPatients = enrichedPatients.length > 0 ? enrichedPatients : patients;

  // Derivados por paciente
  const withInsights = useMemo(() => {
    const now = new Date();
    return displayPatients.map((p) => {
      const debt = debtByPatient.get(p.id) ?? null;
      const daysSinceLast = p.last_appointment
        ? differenceInDays(now, new Date(p.last_appointment))
        : null;
      const lapsed =
        p.is_active &&
        !p.next_appointment &&
        daysSinceLast !== null &&
        daysSinceLast >= LAPSED_AFTER_DAYS;
      const age = p.birth_date ? computeAge(p.birth_date) : null;
      return { ...p, debt, daysSinceLast, lapsed, age };
    });
  }, [displayPatients, debtByPatient]);

  type Insight = (typeof withInsights)[number];

  // Segmentos con contadores
  const counts = useMemo(() => ({
    all: withInsights.length,
    active: withInsights.filter((p) => p.is_active).length,
    no_next: withInsights.filter((p) => p.lapsed).length,
    debt: withInsights.filter((p) => p.debt && p.debt.total > 0).length,
    portal: withInsights.filter((p) => p.auth_user_id !== null).length,
    inactive: withInsights.filter((p) => !p.is_active).length,
  }), [withInsights]);

  const SEGMENTS: { id: Segment; label: string; count: number; alert?: boolean }[] = [
    { id: "all", label: "Todos", count: counts.all },
    { id: "active", label: "En tratamiento", count: counts.active },
    { id: "no_next", label: "Sin próxima cita", count: counts.no_next, alert: counts.no_next > 0 },
    { id: "debt", label: "Con deuda", count: counts.debt, alert: counts.debt > 0 },
    { id: "portal", label: "Portal", count: counts.portal },
    { id: "inactive", label: "Inactivos", count: counts.inactive },
  ];

  const filteredPatients = useMemo(() => {
    let filtered: Insight[] = [...withInsights];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const qDigits = q.replace(/\D/g, "");
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          (qDigits.length >= 3 && p.whatsapp_phone?.replace(/\D/g, "").includes(qDigits))
      );
    }
    switch (segment) {
      case "active":
        filtered = filtered.filter((p) => p.is_active);
        break;
      case "no_next":
        filtered = filtered.filter((p) => p.lapsed);
        break;
      case "debt":
        filtered = filtered.filter((p) => p.debt && p.debt.total > 0);
        break;
      case "portal":
        filtered = filtered.filter((p) => p.auth_user_id !== null);
        break;
      case "inactive":
        filtered = filtered.filter((p) => !p.is_active);
        break;
    }
    return filtered;
  }, [withInsights, searchTerm, segment]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, segment]);

  const { paginatedItems: pagePatients, totalPages } = usePagination(filteredPatients, currentPage);

  if (!businessId && businessLoading) {
    return <RouteSkeleton />;
  }

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const pickSegment = (s: Segment) => {
    setSegment(s);
    if (s === "portal") setSearchParams({ portal: "true" });
    else setSearchParams({});
  };

  const rebookWhatsApp = (p: Insight) => {
    const first = p.full_name.trim().split(/\s+/)[0];
    openWhatsApp(
      p.whatsapp_phone!,
      `Hola ${first} 👋 ¿Cómo estás? Te escribo para coordinar tu próxima sesión. Contame qué días te quedan cómodos y lo agendamos.`
    );
  };

  // Chips de estado de un paciente (compartidos entre tarjeta y tabla)
  const PatientChips = ({ p, compact = false }: { p: Insight; compact?: boolean }) => (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
      {p.next_appointment ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold capitalize">
          <CalendarClock className="h-3 w-3" />
          {format(new Date(p.next_appointment), "EEE d/M · HH:mm", { locale: es })}
        </span>
      ) : p.lapsed ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[11px] font-semibold">
          <AlertTriangle className="h-3 w-3" />
          {p.daysSinceLast! >= 14
            ? `${Math.floor(p.daysSinceLast! / 7)} sem sin venir`
            : "Sin próxima cita"}
        </span>
      ) : null}
      {p.debt && p.debt.total > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/12 text-rose-600 dark:text-rose-400 px-2 py-0.5 text-[11px] font-semibold">
          Debe {formatCurrency(p.debt.total, p.debt.currency)}
        </span>
      )}
      {!p.is_active && (
        <Badge variant="secondary" className="text-[10px] rounded-full px-2">Inactivo</Badge>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5">

        {/* Encabezado: título + pulso de la cartera */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight inline-flex items-center gap-2">
              Pacientes
              <HelpTooltip id="patients" />
            </h1>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {counts.active} en tratamiento
              {counts.no_next > 0 && (
                <>
                  {" "}· <span className="text-amber-600 dark:text-amber-400 font-medium">{counts.no_next} sin próxima cita</span>
                </>
              )}
              {counts.debt > 0 && (
                <>
                  {" "}· <span className="text-rose-600 dark:text-rose-400 font-medium">{counts.debt} con deuda</span>
                </>
              )}
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="hidden sm:inline-flex gap-2 rounded-xl h-11 px-5 font-semibold shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        </div>

        {/* Búsqueda */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, teléfono o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 h-11 rounded-2xl text-[15px] bg-card border-border/50 shadow-sm focus-visible:ring-primary/30 focus-visible:border-primary/50"
          />
        </div>

        {/* Segmentos que responden preguntas reales */}
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {SEGMENTS.map((s) => {
            const selected = segment === s.id;
            return (
              <button
                key={s.id}
                onClick={() => pickSegment(s.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-all",
                  selected
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10.5px] tabular-nums",
                    selected
                      ? "bg-background/20"
                      : s.alert
                        ? s.id === "debt"
                          ? "bg-rose-500/15 text-rose-500"
                          : "bg-amber-500/15 text-amber-500"
                        : "bg-foreground/[0.06]"
                  )}
                >
                  {s.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Contenido */}
        {dataLoading && displayPatients.length === 0 ? (
          <RouteSkeleton />
        ) : filteredPatients.length === 0 ? (
          <Card className="border-dashed border-2 border-border/50">
            <CardContent className="py-16 text-center space-y-3">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                {segment === "no_next"
                  ? "Nadie sin próxima cita 🙌"
                  : segment === "debt"
                    ? "Nadie con deuda 🙌"
                    : "No se encontraron pacientes"}
              </p>
              <p className="text-sm text-muted-foreground/70">
                {segment === "no_next" || segment === "debt"
                  ? "Tu cartera está al día."
                  : "Ajustá la búsqueda o agregá un nuevo paciente."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile: tarjetas con la historia del paciente */}
            <div className="md:hidden space-y-2">
              {pagePatients.map((patient, i) => (
                <Card
                  key={patient.id}
                  className="border-border/40 shadow-sm active:scale-[0.985] transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-1"
                  style={{ animationDelay: `${Math.min(i * 30, 250)}ms`, animationDuration: "300ms", animationFillMode: "both" }}
                  onClick={() => navigate(`/patients/${patient.id}`)}
                >
                  <CardContent className="p-3.5 flex items-center gap-3">
                    <Avatar className={cn(
                      "shrink-0 h-11 w-11 rounded-full",
                      patient.is_active ? "ring-2 ring-primary/15" : "opacity-60"
                    )}>
                      {patient.avatar_url && <AvatarImage src={patient.avatar_url} alt={patient.full_name} className="object-cover" />}
                      <AvatarFallback className={cn(
                        "rounded-full text-sm font-bold",
                        patient.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {getInitials(patient.full_name) || <UserIcon className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[15px] font-semibold text-foreground truncate">
                          {patient.full_name}
                        </p>
                        {patient.age !== null && (
                          <span className="text-[11px] text-muted-foreground shrink-0">{patient.age}</span>
                        )}
                        {patient.auth_user_id && (
                          <Smartphone className="h-3 w-3 text-primary/70 shrink-0" />
                        )}
                      </div>
                      <PatientChips p={patient} compact />
                    </div>

                    {/* Reenganche: WhatsApp directo cuando quedó sin próxima */}
                    {patient.lapsed && patient.whatsapp_phone ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rebookWhatsApp(patient);
                        }}
                        className="shrink-0 h-9 w-9 rounded-full bg-emerald-500/12 flex items-center justify-center text-emerald-600 dark:text-emerald-400 active:scale-90 transition-transform"
                        aria-label={`Escribir a ${patient.full_name} para reagendar`}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: tabla enriquecida */}
            <div className="hidden md:block">
              <Card className="border-border/40 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Paciente</TableHead>
                      <TableHead className="font-semibold">Contacto</TableHead>
                      <TableHead className="font-semibold">Próxima cita</TableHead>
                      <TableHead className="font-semibold">Última consulta</TableHead>
                      <TableHead className="font-semibold">Deuda</TableHead>
                      <TableHead className="font-semibold text-center">
                        <span className="inline-flex items-center gap-1 justify-center">
                          Portal
                          <HelpTooltip id="patientsPortalColumn" />
                        </span>
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagePatients.map((patient) => (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer hover:bg-primary/[0.03] transition-colors group"
                        onClick={() => navigate(`/patients/${patient.id}`)}
                      >
                        <TableCell className="py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar className={cn("shrink-0 h-9 w-9 rounded-full", !patient.is_active && "opacity-60")}>
                              {patient.avatar_url && <AvatarImage src={patient.avatar_url} alt={patient.full_name} className="object-cover" />}
                              <AvatarFallback className={cn(
                                "rounded-full text-xs font-bold",
                                patient.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                              )}>
                                {getInitials(patient.full_name) || <UserIcon className="h-4 w-4" />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-medium">{patient.full_name}</span>
                              <span className="ml-1.5 text-xs text-muted-foreground">
                                {patient.age !== null ? `${patient.age} años` : ""}
                              </span>
                              {!patient.is_active && (
                                <Badge variant="secondary" className="ml-2 text-[10px] rounded-full px-2">Inactivo</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="text-sm">{patient.whatsapp_phone || "-"}</p>
                            {patient.email && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{patient.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {patient.next_appointment ? (
                            <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium capitalize">
                              <CalendarClock className="h-3.5 w-3.5" />
                              {format(new Date(patient.next_appointment), "EEE d/M · HH:mm", { locale: es })}
                            </span>
                          ) : patient.lapsed ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-sm text-amber-600 dark:text-amber-400 font-medium">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {patient.daysSinceLast! >= 14
                                  ? `${Math.floor(patient.daysSinceLast! / 7)} sem sin venir`
                                  : "Sin próxima"}
                              </span>
                              {patient.whatsapp_phone && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    rebookWhatsApp(patient);
                                  }}
                                  className="h-7 w-7 rounded-full bg-emerald-500/12 flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                  title="Escribirle para reagendar"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {patient.last_appointment
                            ? format(new Date(patient.last_appointment), "d/M/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {patient.debt && patient.debt.total > 0 ? (
                            <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                              {formatCurrency(patient.debt.total, patient.debt.currency)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {patient.auth_user_id ? (
                            <Smartphone className="h-4 w-4 text-primary inline-block" />
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            {/* Pagination */}
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredPatients.length}
              pageSize={ITEMS_PER_PAGE}
            />

            {/* Export discreto al pie */}
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground gap-2 rounded-full"
                onClick={() => {
                  const headers = ["Nombre", "Email", "Teléfono", "Próxima cita", "Última consulta", "Fecha de alta"];
                  const rows = filteredPatients.map((p) => [
                    p.full_name,
                    p.email || "",
                    p.whatsapp_phone || "",
                    p.next_appointment ? new Date(p.next_appointment).toLocaleString("es-UY") : "",
                    p.last_appointment ? new Date(p.last_appointment).toLocaleDateString("es-UY") : "",
                    p.created_at ? new Date(p.created_at).toLocaleDateString("es-UY") : "",
                  ]);
                  exportCSV(headers, rows, `pacientes_${todayDateString()}.csv`);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Exportar CSV
              </Button>
            </div>
          </>
        )}
      </div>

      {/* FAB - Nuevo Paciente (solo mobile; en desktop está en el encabezado) */}
      <Button
        onClick={() => setShowForm(true)}
        className="sm:hidden fixed bottom-6 right-6 h-14 w-14 rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all z-40"
      >
        <Plus className="h-6 w-6" />
      </Button>

      <PatientForm
        open={showForm}
        onOpenChange={setShowForm}
        businessId={businessId}
        onSuccess={() => {
          setShowForm(false);
          queryClient.invalidateQueries({ queryKey: ["patients", businessId] });
          queryClient.invalidateQueries({ queryKey: ["patients_appointments", businessId] });
        }}
      />
    </div>
  );
};

export default Patients;

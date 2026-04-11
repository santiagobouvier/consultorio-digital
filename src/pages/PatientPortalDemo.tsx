import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  User, Calendar, CreditCard, Clock, MapPin, Video,
  Phone, Mail, Building2, ArrowLeft, FileText, 
  LayoutDashboard, Star, Heart, TrendingUp, CalendarCheck,
  ChevronRight, CheckCircle2, AlertCircle
} from "lucide-react";
import { formatCurrency } from "@/lib/payments";

// ---- Simulated data (hardcoded, no DB calls) ----
const DEMO_PATIENT = {
  full_name: "Sofía Martínez",
  email: "sofia.martinez@email.com",
  whatsapp_phone: "+598 99 111 111",
  reason_for_consultation: "Manejo de ansiedad y estrés laboral",
  created_at: "2025-11-15",
  private_notes: "Sofía ha mostrado avances significativos en técnicas de respiración y mindfulness. Continuar trabajando en límites laborales.",
};

const DEMO_BUSINESS = {
  name: "Consultorio Dra. María López",
  specialty: "Psicología Clínica",
  contact_email: "dra.lopez@consultorio.com",
};

const today = new Date();
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const formatDate = (d: Date) => d.toLocaleDateString("es-UY", { weekday: "long", day: "numeric", month: "long" });
const formatShort = (d: Date) => d.toLocaleDateString("es-UY", { day: "numeric", month: "long", year: "numeric" });

const UPCOMING = [
  { id: "1", date: addDays(today, 3), start: "10:00", end: "10:50", status: "confirmed", modality: "presencial", location: "Av. 18 de Julio 1234", service: "Sesión individual", notes: null },
  { id: "2", date: addDays(today, 10), start: "14:00", end: "14:50", status: "pending", modality: "online", location: null, service: "Sesión individual", notes: "Preparar ejercicio de journaling" },
];

const PAST = [
  { id: "3", date: addDays(today, -7), start: "10:00", end: "10:50", status: "completed", modality: "presencial", service: "Sesión individual", notes: "Trabajamos técnicas de grounding. Sofía reporta mejoría en episodios de ansiedad nocturna." },
  { id: "4", date: addDays(today, -14), start: "10:00", end: "10:50", status: "completed", modality: "online", service: "Sesión individual", notes: "Revisión de diario emocional. Identificamos patrones de estrés relacionados con reuniones laborales." },
  { id: "5", date: addDays(today, -21), start: "14:00", end: "14:50", status: "completed", modality: "presencial", service: "Sesión individual", notes: "Primera sesión de EMDR. Buena respuesta inicial." },
  { id: "6", date: addDays(today, -28), start: "10:00", end: "10:50", status: "completed", modality: "presencial", service: "Sesión individual", notes: null },
  { id: "7", date: addDays(today, -35), start: "10:00", end: "10:50", status: "no_show", modality: "presencial", service: "Sesión individual", notes: null },
];

const PAYMENTS = [
  { id: "1", amount: 1800, due_date: addDays(today, 5), status: "pending", paid_at: null, recurrence: "Mensual", notes: "Abril 2026" },
  { id: "2", amount: 1800, due_date: addDays(today, -25), status: "paid", paid_at: addDays(today, -24), recurrence: "Mensual", notes: "Marzo 2026" },
  { id: "3", amount: 1800, due_date: addDays(today, -55), status: "paid", paid_at: addDays(today, -53), recurrence: "Mensual", notes: "Febrero 2026" },
  { id: "4", amount: 1800, due_date: addDays(today, -86), status: "paid", paid_at: addDays(today, -86), recurrence: "Mensual", notes: "Enero 2026" },
  { id: "5", amount: 1500, due_date: addDays(today, -116), status: "paid", paid_at: addDays(today, -115), recurrence: "Mensual", notes: "Diciembre 2025" },
];

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "citas", label: "Citas", icon: Calendar },
  { id: "historial", label: "Historial", icon: FileText },
  { id: "pagos", label: "Pagos", icon: CreditCard },
  { id: "perfil", label: "Perfil", icon: User },
] as const;

const PatientPortalDemo = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("resumen");

  const totalSessions = PAST.filter(a => a.status === "completed").length;
  const totalPaid = PAYMENTS.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const pendingCount = PAYMENTS.filter(p => p.status === "pending").length;

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pendiente" },
      confirmed: { variant: "default", label: "Confirmada" },
      completed: { variant: "outline", label: "Completada" },
      cancelled: { variant: "destructive", label: "Cancelada" },
      no_show: { variant: "destructive", label: "Ausente" },
    };
    const c = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const payBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-primary/90 text-primary-foreground hover:bg-primary/90">Pagado</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  // ---- Tab Content Components ----

  const ResumenTab = () => (
    <div className="space-y-6">
      {/* Welcome hero - desktop only */}
      <div className="hidden lg:block rounded-xl border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-8">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20 border-4 border-primary/20">
            <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">SM</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Hola, {DEMO_PATIENT.full_name.split(" ")[0]} 👋</h2>
            <p className="text-muted-foreground mt-1">Acá podés ver tu resumen, próximas citas, pagos e historial.</p>
            <p className="text-xs text-muted-foreground mt-2">{DEMO_BUSINESS.name} · {DEMO_BUSINESS.specialty}</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Card className="group hover:shadow-md transition-all">
          <CardContent className="pt-4 pb-3 lg:pt-6 lg:pb-4 text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 mb-2 lg:mb-3">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-primary">{UPCOMING.length}</p>
            <p className="text-xs lg:text-sm text-muted-foreground">Próximas citas</p>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all">
          <CardContent className="pt-4 pb-3 lg:pt-6 lg:pb-4 text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-accent/10 mb-2 lg:mb-3">
              <CalendarCheck className="h-5 w-5 text-accent-foreground" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold">{totalSessions}</p>
            <p className="text-xs lg:text-sm text-muted-foreground">Sesiones realizadas</p>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all">
          <CardContent className="pt-4 pb-3 lg:pt-6 lg:pb-4 text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-destructive/10 mb-2 lg:mb-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-destructive">{pendingCount}</p>
            <p className="text-xs lg:text-sm text-muted-foreground">Pagos pendientes</p>
          </CardContent>
        </Card>
        <Card className="group hover:shadow-md transition-all">
          <CardContent className="pt-4 pb-3 lg:pt-6 lg:pb-4 text-center">
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 mb-2 lg:mb-3">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-primary">{formatCurrency(totalPaid, "UYU")}</p>
            <p className="text-xs lg:text-sm text-muted-foreground">Total pagado</p>
          </CardContent>
        </Card>
      </div>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Next appointment */}
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Próxima cita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm lg:text-base capitalize">{formatDate(UPCOMING[0].date)}</p>
                  <p className="text-sm text-muted-foreground">{UPCOMING[0].start} - {UPCOMING[0].end} hs</p>
                </div>
                {statusBadge(UPCOMING[0].status)}
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{UPCOMING[0].location || "Presencial"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{UPCOMING[0].service}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Professional notes */}
        <Card className="hover:shadow-md transition-all">
          <CardHeader className="pb-2 lg:pb-3">
            <CardTitle className="text-base lg:text-lg flex items-center gap-2">
              <Heart className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
              Notas de tu profesional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted/50 p-4 lg:p-5">
              <p className="text-sm lg:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap italic">
                "{DEMO_PATIENT.private_notes}"
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending payment alert */}
      <Card className="border-destructive/30 bg-destructive/5 hover:shadow-md transition-all">
        <CardContent className="p-4 lg:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-sm lg:text-base">Tenés 1 pago pendiente</p>
              <p className="text-xs lg:text-sm text-muted-foreground">{formatCurrency(1800, "UYU")} — Vence {formatShort(PAYMENTS[0].due_date)}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2" onClick={() => setTab("pagos")}>
            Ver pagos <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const CitasTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Próximas citas
        </h2>
        <Badge variant="secondary" className="text-xs">{UPCOMING.length} programadas</Badge>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {UPCOMING.map(apt => (
          <Card key={apt.id} className="hover:shadow-md transition-all overflow-hidden">
            <div className="h-1 bg-primary" />
            <CardContent className="p-4 lg:p-6 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm lg:text-base capitalize">{formatDate(apt.date)}</p>
                  <p className="text-sm text-muted-foreground">{apt.start} - {apt.end} hs</p>
                </div>
                {statusBadge(apt.status)}
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {apt.modality === "online" ? <Video className="h-4 w-4 text-primary shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
                <span>{apt.modality === "online" ? "Sesión online" : apt.location || "Presencial"}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{apt.service}</span>
              </div>
              {apt.notes && (
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  💡 {apt.notes}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const HistorialTab = () => (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Historial de sesiones
        </h2>
        <Badge variant="secondary" className="text-xs">{PAST.length} sesiones</Badge>
      </div>
      <div className="space-y-3 lg:space-y-4">
        {PAST.map(apt => (
          <Card key={apt.id} className={`hover:shadow-md transition-all ${apt.status === "no_show" ? "opacity-60" : ""}`}>
            <CardContent className="p-4 lg:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-6">
                {/* Date column */}
                <div className="lg:w-48 shrink-0">
                  <div className="flex items-center lg:flex-col lg:items-start gap-2 lg:gap-0">
                    <p className="font-semibold text-sm lg:text-base">{formatShort(apt.date)}</p>
                    <p className="text-xs text-muted-foreground">{apt.start} - {apt.end} hs</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-primary">{apt.service}</p>
                    <span className="lg:hidden">{statusBadge(apt.status)}</span>
                  </div>
                </div>
                {/* Divider - desktop only */}
                <div className="hidden lg:block w-px bg-border self-stretch" />
                {/* Notes column */}
                <div className="flex-1 min-w-0">
                  <div className="hidden lg:flex items-center justify-between mb-2">
                    {statusBadge(apt.status)}
                    {apt.modality === "online" ? 
                      <Badge variant="outline" className="text-xs gap-1"><Video className="h-3 w-3" /> Online</Badge> : 
                      <Badge variant="outline" className="text-xs gap-1"><MapPin className="h-3 w-3" /> Presencial</Badge>
                    }
                  </div>
                  {apt.notes ? (
                    <div className="rounded-lg bg-muted/40 p-3 lg:p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Notas de la sesión</p>
                      <p className="text-xs lg:text-sm text-foreground leading-relaxed whitespace-pre-wrap">{apt.notes}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sin notas para esta sesión</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const PagosTab = () => (
    <div className="space-y-4 lg:space-y-6">
      {/* Payment summary banner */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 lg:gap-4">
              <div className="h-10 w-10 lg:h-12 lg:w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 lg:h-6 lg:w-6 text-destructive" />
              </div>
              <div>
                <p className="font-semibold text-sm lg:text-base">Tenés pagos pendientes</p>
                <p className="text-xs lg:text-sm text-muted-foreground">{PAYMENTS.filter(p => p.status === "paid").length} de {PAYMENTS.length} pagos realizados</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg lg:text-xl font-bold text-primary">{formatCurrency(totalPaid, "UYU")}</p>
              <p className="text-xs text-muted-foreground">Total pagado</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop: table-like layout; Mobile: cards */}
      <div className="hidden lg:block">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Detalle de pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-muted/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>Concepto</span>
                <span>Monto</span>
                <span>Vencimiento</span>
                <span>Estado</span>
                <span>Fecha de pago</span>
              </div>
              {PAYMENTS.map((p, i) => (
                <div key={p.id} className={`grid grid-cols-5 gap-4 px-4 py-4 items-center text-sm ${i !== PAYMENTS.length - 1 ? "border-b" : ""} hover:bg-muted/30 transition-colors`}>
                  <span className="font-medium">{p.notes || p.recurrence}</span>
                  <span className="font-semibold">{formatCurrency(p.amount, "UYU")}</span>
                  <span className="text-muted-foreground">{formatShort(p.due_date)}</span>
                  <span>{payBadge(p.status)}</span>
                  <span className="text-muted-foreground">{p.paid_at ? formatShort(p.paid_at) : "—"}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        <h3 className="text-base font-bold flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> Detalle de pagos
        </h3>
        {PAYMENTS.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-all">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{formatCurrency(p.amount, "UYU")}</p>
                  <p className="text-xs text-muted-foreground">Vence: {formatShort(p.due_date)}</p>
                </div>
                {payBadge(p.status)}
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.notes || p.recurrence}</span>
                {p.paid_at && <span>Pagado: {formatShort(p.paid_at)}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const PerfilTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
      {/* Patient profile card */}
      <Card className="hover:shadow-md transition-all">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <User className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Mi perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 lg:space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b">
            <Avatar className="h-16 w-16 lg:h-20 lg:w-20 border-4 border-primary/20">
              <AvatarFallback className="text-xl lg:text-2xl font-bold bg-primary/10 text-primary">SM</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-base lg:text-lg">{DEMO_PATIENT.full_name}</p>
              <p className="text-xs lg:text-sm text-muted-foreground">Paciente desde noviembre 2025</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{DEMO_PATIENT.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="font-medium">{DEMO_PATIENT.whatsapp_phone}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Motivo de consulta</p>
              <div className="rounded-lg bg-muted/40 p-3 lg:p-4">
                <p className="text-sm lg:text-base leading-relaxed">{DEMO_PATIENT.reason_for_consultation}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinic info card */}
      <Card className="hover:shadow-md transition-all">
        <CardHeader className="pb-3">
          <CardTitle className="text-base lg:text-lg flex items-center gap-2">
            <Building2 className="h-4 w-4 lg:h-5 lg:w-5 text-primary" /> Mi consultorio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 lg:space-y-5">
          <div className="flex items-center gap-4 pb-4 border-b">
            <div className="h-16 w-16 lg:h-20 lg:w-20 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-8 w-8 lg:h-10 lg:w-10 text-primary" />
            </div>
            <div>
              <p className="font-bold text-base lg:text-lg">{DEMO_BUSINESS.name}</p>
              <p className="text-sm text-muted-foreground capitalize">{DEMO_BUSINESS.specialty}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Contacto</p>
              <p className="font-medium">{DEMO_BUSINESS.contact_email}</p>
            </div>
          </div>
          
          {/* Quick stats */}
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-lg font-bold text-primary">{totalSessions}</p>
              <p className="text-xs text-muted-foreground">Sesiones</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-lg font-bold">{UPCOMING.length + PAST.length}</p>
              <p className="text-xs text-muted-foreground">Total citas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const tabContent: Record<string, JSX.Element> = {
    resumen: <ResumenTab />,
    citas: <CitasTab />,
    historial: <HistorialTab />,
    pagos: <PagosTab />,
    perfil: <PerfilTab />,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium">
        <Star className="inline h-4 w-4 mr-1 -mt-0.5" />
        Demo — Así ve un paciente su portal personal
      </div>

      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            <Avatar className="h-9 w-9 lg:h-10 lg:w-10 hidden lg:flex">
              <AvatarFallback className="bg-primary/10 text-primary font-bold">SM</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-lg lg:text-xl font-bold">Mi Portal</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">{DEMO_BUSINESS.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver al panel</span>
          </Button>
        </div>
      </header>

      <div className="lg:flex lg:gap-0 min-h-[calc(100vh-6rem)]">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:flex lg:flex-col w-72 shrink-0 border-r bg-card/80 backdrop-blur-sm sticky top-16 self-start h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 mb-3">Navegación</p>
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                  {t.id === "pagos" && pendingCount > 0 && (
                    <span className="ml-auto bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {pendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar patient info */}
          <div className="p-4 border-t mt-4">
            <div className="flex items-center gap-3 mb-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">SM</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{DEMO_PATIENT.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{DEMO_PATIENT.email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Tab Bar */}
        <div className="lg:hidden border-b bg-card sticky top-[52px] z-10">
          <div className="flex overflow-x-auto px-2">
            {TABS.map(t => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive 
                      ? "border-primary text-primary" 
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 lg:px-8 py-4 lg:py-8">
          {/* Mobile welcome */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">SM</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">Hola, {DEMO_PATIENT.full_name.split(" ")[0]} 👋</p>
              <p className="text-xs text-muted-foreground">{DEMO_BUSINESS.name}</p>
            </div>
          </div>

          {tabContent[tab]}
        </main>
      </div>
    </div>
  );
};

export default PatientPortalDemo;

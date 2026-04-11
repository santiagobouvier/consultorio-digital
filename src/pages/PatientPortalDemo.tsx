import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  User, Calendar, CreditCard, Clock, AlertTriangle, MapPin, Video,
  Phone, Mail, Building2, CheckCircle2, AlertCircle, XCircle,
  ArrowLeft, FileText, LayoutDashboard, Star, Heart
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
    if (status === "paid") return <Badge className="bg-green-600 text-white hover:bg-green-600">Pagado</Badge>;
    if (status === "overdue") return <Badge variant="destructive">Vencido</Badge>;
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <div className="bg-primary text-primary-foreground text-center py-2 px-4 text-sm font-medium">
        <Star className="inline h-4 w-4 mr-1 -mt-0.5" />
        Demo — Así ve un paciente su portal
      </div>

      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Mi Portal</h1>
            <p className="text-xs text-muted-foreground">{DEMO_BUSINESS.name}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver al panel</span>
          </Button>
        </div>
      </header>

      <main className="container max-w-3xl mx-auto px-4 py-4">
        {/* Status banner */}
        <div className="rounded-lg border p-3 mb-4 bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span className="font-medium text-sm">Tenés 1 pago pendiente</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full grid grid-cols-5 mb-4">
            <TabsTrigger value="resumen" className="text-xs sm:text-sm">
              <LayoutDashboard className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="citas" className="text-xs sm:text-sm">
              <Calendar className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Citas</span>
            </TabsTrigger>
            <TabsTrigger value="historial" className="text-xs sm:text-sm">
              <FileText className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Historial</span>
            </TabsTrigger>
            <TabsTrigger value="pagos" className="text-xs sm:text-sm">
              <CreditCard className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Pagos</span>
            </TabsTrigger>
            <TabsTrigger value="perfil" className="text-xs sm:text-sm">
              <User className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Perfil</span>
            </TabsTrigger>
          </TabsList>

          {/* RESUMEN */}
          <TabsContent value="resumen" className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-primary">{UPCOMING.length}</p>
                <p className="text-xs text-muted-foreground">Próximas citas</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold">{totalSessions}</p>
                <p className="text-xs text-muted-foreground">Sesiones realizadas</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-orange-500">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pagos pendientes</p>
              </CardContent></Card>
              <Card><CardContent className="pt-4 pb-3 text-center">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid, "UYU")}</p>
                <p className="text-xs text-muted-foreground">Total pagado</p>
              </CardContent></Card>
            </div>

            {/* Next appointment */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Próxima cita</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium capitalize">{formatDate(UPCOMING[0].date)}</p>
                    <p className="text-sm text-muted-foreground">{UPCOMING[0].start} - {UPCOMING[0].end} hs</p>
                    <p className="text-xs text-primary mt-1">{UPCOMING[0].service}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                    {statusBadge(UPCOMING[0].status)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4 text-primary" /> Notas de tu profesional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{DEMO_PATIENT.private_notes}</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CITAS */}
          <TabsContent value="citas" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Próximas citas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {UPCOMING.map(apt => (
                  <div key={apt.id} className="border rounded-lg p-4 space-y-2 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">{formatDate(apt.date)}</p>
                        <p className="text-sm text-muted-foreground">{apt.start} - {apt.end} hs</p>
                        <p className="text-xs text-primary mt-1">{apt.service}</p>
                      </div>
                      {statusBadge(apt.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {apt.modality === "online" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                      <span>{apt.modality === "online" ? "Sesión online" : apt.location || "Presencial"}</span>
                    </div>
                    {apt.notes && <p className="text-xs text-muted-foreground border-t pt-2 mt-2">{apt.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Historial de sesiones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PAST.map(apt => (
                  <div key={apt.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{formatShort(apt.date)}</p>
                        <p className="text-xs text-muted-foreground">{apt.start} - {apt.end} hs</p>
                        <p className="text-xs text-primary mt-0.5">{apt.service}</p>
                      </div>
                      {statusBadge(apt.status)}
                    </div>
                    {apt.notes && (
                      <div className="border-t pt-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Notas de la sesión</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{apt.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PAGOS */}
          <TabsContent value="pagos" className="space-y-4">
            <div className="rounded-lg border p-4 bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-300">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Tenés pagos pendientes</p>
                  <p className="text-xs opacity-80">{PAYMENTS.filter(p => p.status === "paid").length} de {PAYMENTS.length} pagos realizados</p>
                </div>
              </div>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Detalle de pagos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {PAYMENTS.map(p => (
                  <div key={p.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{formatCurrency(p.amount, "UYU")}</p>
                        <p className="text-xs text-muted-foreground">Vence: {formatShort(p.due_date)}</p>
                      </div>
                      {payBadge(p.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{p.recurrence}</span>
                      {p.paid_at && <span>Pagado: {formatShort(p.paid_at)}</span>}
                    </div>
                    {p.notes && <p className="text-xs text-muted-foreground border-t pt-2">{p.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PERFIL */}
          <TabsContent value="perfil" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Mi perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{DEMO_PATIENT.full_name}</p>
                    <p className="text-xs text-muted-foreground">Paciente desde noviembre 2025</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{DEMO_PATIENT.email}</span></div>
                  <div className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{DEMO_PATIENT.whatsapp_phone}</span></div>
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Motivo de consulta</p>
                    <p className="text-sm">{DEMO_PATIENT.reason_for_consultation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Mi consultorio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-medium">{DEMO_BUSINESS.name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{DEMO_BUSINESS.specialty}</p>
                </div>
                <div className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /><span>{DEMO_BUSINESS.contact_email}</span></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PatientPortalDemo;

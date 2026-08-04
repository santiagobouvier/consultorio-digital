// Demo del expediente clínico: la ficha de un paciente de ejemplo con su
// historia por sesión (notas, adjuntos, pagos) en modo solo lectura. Réplica
// visual del expediente real con datos ficticios — nada se guarda y las
// acciones avisan que es demo. El diferencial del producto, en vidriera.
import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, StickyNote, Paperclip, ClipboardList, CalendarClock, CalendarPlus,
  MessageCircle, Pencil, UserPlus, MapPin, Video, Maximize2, Plus, Upload,
  Download, Eye, Trash2, CalendarDays, Check, CreditCard, Clock,
  AlertTriangle, HeartPulse, Pill, Stethoscope, Mail, Phone, FolderOpen, User as UserIcon,
} from "lucide-react";

const demoToast = () =>
  toast({ title: "Modo demo", description: "En tu panel real acá se hace de verdad — nada se guarda en la demo." });

// ── Datos de ejemplo ──
const day = (offset: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(h, 0, 0, 0);
  return d;
};

interface DemoSession {
  id: string;
  start: Date;
  service: string;
  modality: "online" | "presencial";
  status: "attended" | "confirmed" | "cancelled";
  pay: "paid" | "pending" | "overdue" | null;
  amount: number;
  note: { status: "finalized" | "draft"; content: string } | null;
  docs: { name: string; type: string; size: string; shared?: boolean }[];
}

const SESSIONS: DemoSession[] = [
  {
    id: "s1",
    start: day(-2, 15),
    service: "Sesión individual",
    modality: "presencial",
    status: "attended",
    pay: "paid",
    amount: 1500,
    note: {
      status: "finalized",
      content:
        "Trabajamos técnicas de respiración ante episodios de ansiedad. Se observa mejora en la adherencia a rutinas. Tarea: registro semanal de disparadores.",
    },
    docs: [
      { name: "Informe_de_evolucion.pdf", type: "Informe", size: "182 KB", shared: true },
      { name: "Ejercicios_respiracion.pdf", type: "Indicaciones / Material", size: "96 KB" },
    ],
  },
  {
    id: "s2",
    start: day(-9, 15),
    service: "Sesión individual",
    modality: "online",
    status: "attended",
    pay: "paid",
    amount: 1500,
    note: {
      status: "finalized",
      content:
        "Revisión del registro de disparadores. Identificamos patrones vinculados a la carga laboral. Acordamos pautas de higiene del sueño.",
    },
    docs: [],
  },
  {
    id: "s3",
    start: day(-16, 15),
    service: "Sesión individual",
    modality: "presencial",
    status: "attended",
    pay: "pending",
    amount: 1500,
    note: null,
    docs: [{ name: "Evaluacion_inicial.pdf", type: "Evaluación", size: "310 KB" }],
  },
  {
    id: "s4",
    start: day(-23, 15),
    service: "Primera consulta",
    modality: "presencial",
    status: "attended",
    pay: "paid",
    amount: 2000,
    note: {
      status: "finalized",
      content:
        "Primera entrevista. Motivo: ansiedad en contextos laborales. Antecedentes relevados. Se acuerda frecuencia semanal y objetivos iniciales de tratamiento.",
    },
    docs: [{ name: "Consentimiento_informado.pdf", type: "Consentimiento", size: "240 KB", shared: true }],
  },
];

const UPCOMING = [day(2, 15), day(9, 15)];

const payBadge = (pay: DemoSession["pay"], amount?: number) => {
  if (!pay) return null;
  const map = {
    paid: { label: "Pagada", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
    pending: { label: "Pago pendiente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
    overdue: { label: "Pago vencido", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30" },
  }[pay];
  return (
    <Badge className={cn("text-[10px] border hover:bg-transparent", map.cls)} variant="outline">
      {map.label}
      {amount ? ` · $${amount.toLocaleString("es-UY")}` : ""}
    </Badge>
  );
};

const DemoExpediente = () => {
  const [detail, setDetail] = useState<DemoSession | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,380px)_1fr] gap-6 items-start">
          {/* ══ Carnet del paciente ══ */}
          <div className="space-y-5 lg:sticky lg:top-20">
            <Card className="rounded-2xl">
              <CardContent className="p-6 text-center">
                <div className="h-20 w-20 rounded-3xl bg-primary/10 ring-2 ring-primary/20 mx-auto flex items-center justify-center text-2xl font-bold text-primary">
                  JP
                </div>
                <h2 className="text-xl font-bold mt-3">Juan Pérez</h2>
                <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Activo</Badge>
                  <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">Pagos pendientes</Badge>
                  <Badge variant="secondary" className="text-[10px]">Portal activo</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button size="sm" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <CalendarPlus className="h-3.5 w-3.5" /> Agendar cita
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <UserPlus className="h-3.5 w-3.5" /> Invitar al portal
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: CalendarDays, label: "Próxima cita", value: format(UPCOMING[0], "EEE d · HH:mm", { locale: es }) },
                { icon: Check, label: "Sesiones", value: "12" },
                { icon: CreditCard, label: "Pendiente", value: "$ 1.500" },
                { icon: Clock, label: "Última sesión", value: format(SESSIONS[0].start, "d MMM", { locale: es }) },
              ].map((s) => (
                <Card key={s.label} className="rounded-2xl">
                  <CardContent className="p-3.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <s.icon className="h-3 w-3" /> {s.label}
                    </p>
                    <p className="font-bold text-sm mt-1 capitalize">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ══ Expediente ══ */}
          <div className="min-w-0 space-y-5">
            {/* Estado actual: el estado presente del paciente, arriba de la cronología */}
            <Card className="rounded-2xl border-primary/25 bg-gradient-to-b from-primary/[0.05] to-transparent">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <HeartPulse className="h-3.5 w-3.5" /> Estado actual
                  </p>
                  <Button size="sm" variant="ghost" className="h-7 rounded-lg gap-1.5 text-xs -mr-1" onClick={demoToast}>
                    <Pencil className="h-3 w-3" /> Editar
                  </Button>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="rounded-xl border p-3 flex items-start gap-2.5 bg-amber-500/10 border-amber-500/40">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Requiere seguimiento</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Monitorear evolución del sueño; acordado control mensual con psiquiatra.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                      <Pill className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Medicación actual</p>
                      <p className="text-sm mt-0.5 leading-relaxed">Sertralina 50 mg/día (desde marzo 2026).</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                      <Stethoscope className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Diagnóstico / cuadro actual</p>
                      <p className="text-sm mt-0.5 leading-relaxed">Trastorno de ansiedad generalizada, en tratamiento.</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                    Actualizado el {format(day(-2, 16), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Motivo de consulta */}
            <Card className="rounded-2xl border-primary/20 bg-primary/[0.03]">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" /> Motivo de consulta
                </p>
                <p className="text-sm leading-relaxed">Manejo de ansiedad en contextos laborales y organización de rutinas.</p>
              </CardContent>
            </Card>

            {/* Próximas */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Próximas</span>
              {UPCOMING.map((d, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-xs bg-primary/5 border border-primary/20 rounded-full px-3 py-1.5 shrink-0 capitalize">
                  <CalendarClock className="h-3 w-3 text-primary" />
                  {format(d, "EEE d MMM · HH:mm", { locale: es })}
                </span>
              ))}
            </div>

            {/* Historia por sesión */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Historia por sesión
                </h3>
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/40">1 sin nota</Badge>
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                {["Todas", "Con nota", "Sin nota"].map((f, i) => (
                  <button
                    key={f}
                    onClick={i === 0 ? undefined : demoToast}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                      i === 0 ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Línea de tiempo */}
            <div className="relative">
              <div className="absolute left-[5px] top-3 bottom-3 w-px bg-border" aria-hidden />
              <div className="space-y-4">
                {SESSIONS.map((s) => (
                  <div key={s.id} className="relative pl-6">
                    <span className="absolute left-0 top-5 w-[11px] h-[11px] rounded-full ring-4 ring-background bg-emerald-500" aria-hidden />
                    <Card
                      role="button"
                      onClick={() => setDetail(s)}
                      className="rounded-2xl cursor-pointer transition-all hover:shadow-md hover:border-primary/40"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm capitalize">
                              {format(s.start, "EEEE d 'de' MMMM yyyy", { locale: es })}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                              {format(s.start, "HH:mm")} – {format(new Date(s.start.getTime() + 3600000), "HH:mm")} hs · {s.service} ·
                              <span className="inline-flex items-center gap-1">
                                {s.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                {s.modality === "online" ? "Online" : "Presencial"}
                              </span>
                            </p>
                            <div className="flex items-center gap-3 flex-wrap mt-2">
                              {s.note ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <StickyNote className="h-3 w-3 text-primary" /> Con nota
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                                  <StickyNote className="h-3 w-3" /> Sin nota
                                </span>
                              )}
                              {s.docs.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Paperclip className="h-3 w-3" /> {s.docs.length} adjunto{s.docs.length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
                            <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Realizada</Badge>
                            {payBadge(s.pay)}
                            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Detalle de la sesión (solo lectura) ── */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto p-0 gap-0 rounded-2xl">
          {detail && (
            <>
              <div className="px-5 sm:px-6 pt-6 pb-4 bg-gradient-to-b from-primary/[0.07] to-transparent border-b border-border/60">
                <DialogHeader className="text-left space-y-0">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Detalle de la sesión</p>
                      <DialogTitle className="text-base capitalize leading-tight mt-0.5">
                        {format(detail.start, "EEEE d 'de' MMMM yyyy", { locale: es })}
                      </DialogTitle>
                      <DialogDescription className="text-xs mt-0.5">
                        {format(detail.start, "HH:mm")} – {format(new Date(detail.start.getTime() + 3600000), "HH:mm")} hs · {detail.service}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Realizada</Badge>
                  {payBadge(detail.pay, detail.amount)}
                </div>
              </div>

              <div className="px-5 sm:px-6 py-5 space-y-6">
                {/* Nota */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <StickyNote className="h-3 w-3" /> Nota de la sesión
                  </p>
                  {detail.note ? (
                    <div className="rounded-xl bg-muted/40 border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge className="text-[9px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/15">Finalizada</Badge>
                        <div className="flex gap-0.5">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" onClick={demoToast}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg text-muted-foreground" onClick={demoToast}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm mt-2 leading-relaxed">{detail.note.content}</p>
                    </div>
                  ) : (
                    <button
                      onClick={demoToast}
                      className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors p-3 text-left flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-4 w-4 text-primary shrink-0" />
                      Escribir la nota de esta sesión
                    </button>
                  )}
                </div>

                {/* Adjuntos */}
                <div className="space-y-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Paperclip className="h-3 w-3" /> Adjuntos{detail.docs.length > 0 ? ` · ${detail.docs.length}` : ""}
                  </p>
                  {detail.docs.length === 0 && (
                    <p className="text-xs text-muted-foreground">Esta sesión todavía no tiene documentos adjuntos.</p>
                  )}
                  {detail.docs.map((doc) => (
                    <div key={doc.name}>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80 mb-1.5">{doc.type}</p>
                      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-2.5">
                        <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium break-all leading-snug">{doc.name}</p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            {doc.size}
                            {doc.shared && (
                              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                <Eye className="h-3 w-3" /> compartido
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={demoToast}>Ver</Button>
                          <Button size="sm" variant="outline" className="rounded-lg h-8 w-8 p-0" onClick={demoToast}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={demoToast}
                    className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors p-2.5 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Upload className="h-3.5 w-3.5" /> Adjuntar documento
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  En tu panel real las notas y documentos se guardan de verdad — y los compartís al portal del paciente con un switch.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoExpediente;

// Demo de la agenda del panel. Reusa los componentes REALES del calendario
// actual (DayViewV2 / WeekViewV2) con datos de ejemplo en memoria: se ve
// idéntico al producto de hoy, pero nada se guarda y nada dispara avisos
// (ni WhatsApp ni emails). Tocar una cita abre un detalle de solo lectura.
import { useState } from "react";
import { format, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Video, MapPin, CreditCard, CalendarClock, MessageCircle, XCircle } from "lucide-react";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { DayViewV2 } from "@/components/calendar-v2/DayViewV2";
import { WeekViewV2 } from "@/components/calendar-v2/WeekViewV2";
import {
  type CalendarAppointment,
  type DayPayment,
  APPOINTMENT_STATUS_MAP,
  getPaymentColorInfo,
} from "@/components/calendar-v2/types";

type ViewType = "day" | "week";

// ── Citas de ejemplo ancladas a la semana actual ──
const today = new Date();
const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const plusMin = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString();

const mk = (
  id: string,
  startIso: string,
  full_name: string,
  modality: CalendarAppointment["modality"],
  status: CalendarAppointment["status"],
  paymentColor: CalendarAppointment["paymentColor"],
  serviceName = "Sesión individual",
  durationMin = 60,
): CalendarAppointment => ({
  id,
  start_at: startIso,
  end_at: plusMin(startIso, durationMin),
  status,
  modality,
  location: modality === "in_person" ? "Consultorio — Av. Brasil 2345" : null,
  payment_status: paymentColor === "green" ? "paid" : "pending",
  patient_id: id,
  service_id: null,
  professional_id: null,
  patients: { full_name },
  services: { name: serviceName },
  paymentColor,
});

const APPOINTMENTS: CalendarAppointment[] = [
  // Hoy: un día con ritmo — realizadas, en curso probable y próximas
  mk("a1", at(0, 9, 0), "María González", "in_person", "attended", "green"),
  mk("a2", at(0, 10, 30), "Lucía Fernández", "online", "attended", "orange"),
  mk("a3", at(0, 14, 0), "Diego Martínez", "in_person", "confirmed", "orange"),
  mk("a4", at(0, 16, 0), "Sofía Pereyra", "online", "confirmed", "green", "Primera consulta", 90),
  mk("a5", at(0, 18, 0), "Valentina Méndez", "in_person", "pending", "green"),
  // Resto de la semana
  mk("a6", at(1, 10, 0), "Andrés Silva", "in_person", "confirmed", "red"),
  mk("a7", at(1, 15, 0), "Camila Torres", "online", "confirmed", "green"),
  mk("a8", at(2, 11, 0), "Julián Rodríguez", "online", "confirmed", "green"),
  mk("a9", at(2, 17, 0), "Paula Núñez", "in_person", "pending", "orange"),
  mk("a10", at(3, 9, 30), "Federico García", "in_person", "confirmed", "green"),
  mk("a11", at(4, 14, 0), "Agustina López", "online", "confirmed", "green", "Primera consulta", 90),
  mk("a12", at(-1, 16, 0), "Martín Acosta", "in_person", "attended", "green"),
];

// Un cobro del día, para mostrar el chip de pagos en la vista día
const DAY_PAYMENTS: DayPayment[] = [
  {
    id: "demo-pay-1",
    patient_id: "a3",
    patient_name: "Diego Martínez",
    patient_phone: null,
    due_date: at(0, 14, 0),
    amount: 1500,
    currency: "UYU",
    status: "pending",
    paid_at: null,
    method: null,
    notes: null,
  },
];

const demoToast = () =>
  toast({ title: "Modo demo", description: "En tu panel real acá se hace de verdad — nada se guarda en la demo." });

const DemoAgenda = () => {
  const [viewType, setViewType] = useState<ViewType>("day");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  // Cita abierta en el detalle de solo lectura
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);

  const goPrev = () => setCurrentDate((d) => (viewType === "day" ? subDays(d, 1) : subWeeks(d, 1)));
  const goNext = () => setCurrentDate((d) => (viewType === "day" ? addDays(d, 1) : addWeeks(d, 1)));

  const payInfo = selected ? getPaymentColorInfo(selected.paymentColor) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Agenda</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(currentDate, viewType === "day" ? "EEEE d 'de' MMMM" : "MMMM yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={() => setCurrentDate(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View tabs */}
        <Tabs value={viewType} onValueChange={(v) => setViewType(v as ViewType)}>
          <TabsList className="rounded-xl h-11">
            <TabsTrigger value="day" className="rounded-lg px-4">Día</TabsTrigger>
            <TabsTrigger value="week" className="rounded-lg px-4">Semana</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Vistas: los componentes reales del calendario actual */}
        {viewType === "day" ? (
          <DayViewV2
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            onAppointmentClick={(apt) => setSelected(apt)}
            onAddAppointment={demoToast}
            showProfessionalColors={false}
            dayPayments={DAY_PAYMENTS}
            onPaymentClick={demoToast}
          />
        ) : (
          <WeekViewV2
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            onAppointmentClick={(apt) => setSelected(apt)}
            onDayClick={(date) => {
              setCurrentDate(date);
              setViewType("day");
            }}
            onAddAppointment={demoToast}
            showProfessionalColors={false}
          />
        )}
      </div>

      {/* ── Detalle de la cita: solo lectura, con las acciones del producto real ── */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selected.patients?.full_name}</DialogTitle>
                <DialogDescription className="capitalize">
                  {format(new Date(selected.start_at), "EEEE d 'de' MMMM", { locale: es })} ·{" "}
                  {format(new Date(selected.start_at), "HH:mm")} – {format(new Date(selected.end_at), "HH:mm")} hs
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={APPOINTMENT_STATUS_MAP[selected.status]?.variant || "default"}>
                    {APPOINTMENT_STATUS_MAP[selected.status]?.label || selected.status}
                  </Badge>
                  {payInfo && (
                    <Badge variant="outline" className="gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${payInfo.className}`} />
                      {payInfo.label}
                    </Badge>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                    {selected.services?.name || "Sesión"}
                  </p>
                  <p className="flex items-center gap-2 text-muted-foreground">
                    {selected.modality === "online" ? (
                      <>
                        <Video className="h-4 w-4 shrink-0" /> Online
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4 shrink-0" /> {selected.location || "Presencial"}
                      </>
                    )}
                  </p>
                </div>

                {/* Las acciones del producto real, en modo vitrina */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <CreditCard className="h-4 w-4" /> Cobrar
                  </Button>
                  <Button variant="outline" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </Button>
                  <Button variant="outline" className="rounded-xl gap-1.5" onClick={demoToast}>
                    <CalendarClock className="h-4 w-4" /> Reprogramar
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl gap-1.5 text-destructive hover:text-destructive"
                    onClick={demoToast}
                  >
                    <XCircle className="h-4 w-4" /> Cancelar
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  En tu panel real estas acciones funcionan de verdad: cobros con Mercado Pago, avisos automáticos y más.
                </p>
              </div>

              <DialogFooter>
                <Button className="rounded-xl w-full sm:w-auto" onClick={() => setSelected(null)}>
                  Listo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DemoAgenda;

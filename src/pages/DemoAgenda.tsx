// Demo de la agenda del panel. Reusa los componentes REALES (DayView / WeekView)
// con datos de ejemplo en memoria y acciones desactivadas: se ve idéntico al
// producto, pero nada se guarda y al refrescar vuelve a empezar.
import { useState } from "react";
import { format, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DayView } from "@/components/calendar/DayView";
import { WeekView } from "@/components/calendar/WeekView";

type ViewType = "day" | "week";

// Citas de ejemplo ancladas a la semana actual.
const today = new Date();
const at = (dayOffset: number, h: number, m = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const plusHour = (iso: string) => new Date(new Date(iso).getTime() + 60 * 60 * 1000).toISOString();

const mk = (
  id: string,
  startIso: string,
  full_name: string,
  modality: string,
  status: string,
  payment_status: string,
  paymentColor: string,
) => ({
  id,
  start_at: startIso,
  end_at: plusHour(startIso),
  status,
  modality,
  location: null,
  payment_status,
  patient_id: id,
  service_id: null,
  patients: { full_name },
  services: null,
  paymentColor,
});

const APPOINTMENTS = [
  mk("a1", at(0, 9, 0), "María González", "presencial", "confirmed", "pagado", "green"),
  mk("a2", at(0, 10, 30), "Lucía Fernández", "online", "confirmed", "pendiente", "orange"),
  mk("a3", at(0, 15, 0), "Diego Martínez", "presencial", "pending", "pendiente", "orange"),
  mk("a4", at(1, 11, 0), "Sofía Pereyra", "online", "confirmed", "pagado", "green"),
  mk("a5", at(-1, 16, 0), "Andrés Silva", "presencial", "completed", "vencido", "red"),
  mk("a6", at(2, 12, 0), "Valentina Méndez", "online", "confirmed", "pagado", "green"),
];

const DemoAgenda = () => {
  const [viewType, setViewType] = useState<ViewType>("day");
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const goPrev = () => setCurrentDate((d) => (viewType === "day" ? subDays(d, 1) : subWeeks(d, 1)));
  const goNext = () => setCurrentDate((d) => (viewType === "day" ? addDays(d, 1) : addWeeks(d, 1)));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <DemoBanner />

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Agenda</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(currentDate, viewType === "day" ? "EEEE d 'de' MMMM" : "MMMM yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentDate(new Date())}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={goNext}>
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

        {/* Views (componentes reales con datos de ejemplo) */}
        {viewType === "day" ? (
          <DayView
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            onAppointmentClick={() => {}}
            selectedPatientId={null}
            dayPayments={[]}
          />
        ) : (
          <WeekView
            currentDate={currentDate}
            appointments={APPOINTMENTS}
            onAppointmentClick={() => {}}
            selectedPatientId={null}
          />
        )}
      </div>
    </div>
  );
};

export default DemoAgenda;

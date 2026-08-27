import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  CalendarAppointment,
  DayPayment,
  getStatusLabel,
  getStatusColor,
  getPersonalLabel,
} from "./types";
import { calculatePaymentStatus } from "@/lib/payments";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { Clock, Video, MapPin, CreditCard, X, ClipboardList, Check, Sunrise, Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

const CANCELLED_STATUSES = ["cancelled", "cancelled_by_patient"];

/** Momentos del día: ordenan la ficha visualmente (mañana / tarde / noche). */
const DAY_PERIODS = [
  { id: "morning", label: "Mañana", icon: Sunrise, iconClass: "text-amber-500", from: 0, to: 13 },
  { id: "afternoon", label: "Tarde", icon: Sun, iconClass: "text-orange-500", from: 13, to: 19 },
  { id: "evening", label: "Noche", icon: Moon, iconClass: "text-indigo-400", from: 19, to: 24 },
] as const;

const formatGap = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
};

interface DaySummaryModalProps {
  open: boolean;
  onClose: () => void;
  date: Date;
  /** Citas del día, ya ordenadas por hora (canceladas incluidas). */
  appointments: CalendarAppointment[];
  payments?: DayPayment[];
  onAppointmentClick?: (apt: CalendarAppointment) => void;
  onPaymentClick?: (payment: DayPayment) => void;
}

/**
 * La ficha del día: el resumen clínico de la jornada en un pop-up.
 * Cronología de sesiones con estado y modalidad, canceladas aparte y
 * los cobros del día con su total. Tocar una fila abre el detalle.
 */
export const DaySummaryModal = ({
  open,
  onClose,
  date,
  appointments,
  payments = [],
  onAppointmentClick,
  onPaymentClick,
}: DaySummaryModalProps) => {
  const { primaryColor } = useDashboardBranding();

  const active = appointments.filter((a) => !CANCELLED_STATUSES.includes(a.status));
  const cancelled = appointments.filter((a) => CANCELLED_STATUSES.includes(a.status));
  const done = active.filter((a) => a.status === "attended").length;
  const totalDue = payments
    .filter((p) => !p.paid_at)
    .reduce((acc, p) => acc + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[88dvh] flex flex-col">
        {/* Encabezado con color de marca, como el resto de la agenda */}
        <div
          className="px-5 pt-5 pb-4 border-b border-border/60"
          style={{
            background: `linear-gradient(135deg, hsla(${primaryColor}, 0.13) 0%, hsla(${primaryColor}, 0.04) 60%, transparent 90%)`,
          }}
        >
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            <ClipboardList className="h-3.5 w-3.5" />
            Ficha del día
          </p>
          <h2 className="text-lg font-bold capitalize mt-1">
            {format(date, "EEEE d 'de' MMMM", { locale: es })}
          </h2>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1 tabular-nums">
              {active.length} sesion{active.length !== 1 ? "es" : ""}
            </span>
            {active.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1 tabular-nums">
                <Clock className="h-3 w-3" />
                {format(new Date(active[0].start_at), "HH:mm")} →{" "}
                {format(new Date(active[active.length - 1].end_at), "HH:mm")}
              </span>
            )}
            {done > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">
                <Check className="h-3 w-3" />
                {done} realizada{done !== 1 ? "s" : ""}
              </span>
            )}
            {cancelled.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1">
                <X className="h-3 w-3" />
                {cancelled.length} cancelada{cancelled.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3 space-y-4">
          {/* Cronología de la jornada */}
          {active.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              Día libre 🙌 — sin sesiones agendadas
            </p>
          ) : (
            (() => {
              const renderRow = (apt: CalendarAppointment) => {
                const isPersonal = !!apt.isPersonal;
                const label = isPersonal ? getPersonalLabel(apt.personalEvent) : null;
                const statusColor = getStatusColor(apt.status);
                return (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => onAppointmentClick?.(apt)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl border-l-4 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 min-h-[52px]",
                      statusColor.border,
                      statusColor.bgTint
                    )}
                    style={isPersonal && label ? { borderLeftColor: label.color } : undefined}
                  >
                    <span className="shrink-0 text-sm font-semibold tabular-nums w-[88px]">
                      {format(new Date(apt.start_at), "HH:mm")}–{format(new Date(apt.end_at), "HH:mm")}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">
                        {isPersonal
                          ? apt.personalEvent?.title || "Evento personal"
                          : apt.patients?.full_name || "Sin paciente"}
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {isPersonal ? label?.label : apt.services?.name || "Sesión"}
                      </span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      {!isPersonal && apt.modality === "online" && (
                        <Video className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {!isPersonal && apt.modality === "in_person" && (
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5",
                          apt.status === "attended"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : apt.status === "pending" || apt.status === "reschedule_requested"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : isPersonal
                                ? "bg-muted text-muted-foreground"
                                : "bg-primary/10 text-primary"
                        )}
                      >
                        {isPersonal ? "Personal" : getStatusLabel(apt.status)}
                      </span>
                    </span>
                  </button>
                );
              };

              // La jornada agrupada por momentos: mañana / tarde / noche.
              // Los momentos vacíos solo se muestran si quedan ENTRE momentos
              // con sesiones ("la tarde la tenés libre"); los de las puntas no
              // (si nunca atendés de noche, no hace falta decirlo cada día).
              const byPeriod = DAY_PERIODS.map((p) =>
                active.filter((a) => {
                  const h = new Date(a.start_at).getHours();
                  return h >= p.from && h < p.to;
                })
              );
              const firstIdx = byPeriod.findIndex((g) => g.length > 0);
              const lastIdx = byPeriod.length - 1 - [...byPeriod].reverse().findIndex((g) => g.length > 0);

              return (
                <div className="space-y-4">
                  {DAY_PERIODS.map((period, idx) => {
                    const inPeriod = byPeriod[idx];
                    const isEmpty = inPeriod.length === 0;
                    if (isEmpty && (idx < firstIdx || idx > lastIdx)) return null;
                    const Icon = period.icon;
                    return (
                      <div key={period.id}>
                        <div className="flex items-center gap-2 px-1 pb-1.5">
                          <Icon className={cn("h-3.5 w-3.5", period.iconClass)} />
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {period.label}
                          </p>
                          <span className="flex-1 border-t border-dashed border-border/60" />
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {isEmpty
                              ? "libre 🙌"
                              : `${inPeriod.length} sesion${inPeriod.length !== 1 ? "es" : ""}`}
                          </span>
                        </div>
                        {!isEmpty && (
                          <div className="space-y-1">
                            {inPeriod.map((apt, i) => {
                              const prev = inPeriod[i - 1];
                              const gapMin = prev
                                ? Math.round(
                                    (new Date(apt.start_at).getTime() - new Date(prev.end_at).getTime()) / 60000
                                  )
                                : 0;
                              return (
                                <div key={apt.id}>
                                  {gapMin >= 60 && (
                                    <div className="flex items-center gap-2 px-3 py-1.5">
                                      <span className="flex-1 border-t border-dashed border-border/50" />
                                      <span className="text-[10px] font-medium text-muted-foreground/80 tabular-nums">
                                        {formatGap(gapMin)} libre
                                      </span>
                                      <span className="flex-1 border-t border-dashed border-border/50" />
                                    </div>
                                  )}
                                  {renderRow(apt)}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}

          {/* Canceladas, aparte para no ensuciar la cronología */}
          {cancelled.length > 0 && (
            <div>
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Canceladas
              </p>
              <div className="space-y-1">
                {cancelled.map((apt) => (
                  <button
                    key={apt.id}
                    type="button"
                    onClick={() => onAppointmentClick?.(apt)}
                    className="w-full flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                  >
                    <X className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {format(new Date(apt.start_at), "HH:mm")}
                    </span>
                    <span className="flex-1 text-sm text-muted-foreground line-through truncate">
                      {apt.patients?.full_name || "Sin paciente"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cobros del día */}
          {payments.length > 0 && (
            <div>
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cobros del día
              </p>
              <div className="space-y-1">
                {payments.map((p) => {
                  const st = calculatePaymentStatus({
                    due_date: p.due_date,
                    paid_at: p.paid_at,
                    status: p.status,
                  });
                  const paid = !!p.paid_at;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onPaymentClick?.(p)}
                      className="w-full flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 min-h-[48px]"
                    >
                      <CreditCard
                        className={cn(
                          "h-4 w-4 shrink-0",
                          paid
                            ? "text-emerald-500"
                            : st === "overdue"
                              ? "text-rose-400"
                              : "text-amber-500"
                        )}
                      />
                      <span className="flex-1 text-sm font-medium truncate">{p.patient_name}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        ${p.amount.toLocaleString()}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5",
                          paid
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : st === "overdue"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {paid ? "Pago" : st === "overdue" ? "Vencido" : "Pendiente"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {totalDue > 0 && (
                <p className="px-1 pt-2 text-xs text-muted-foreground text-right">
                  Por cobrar:{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    ${totalDue.toLocaleString()}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

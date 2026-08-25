import { useMemo } from "react";
import { format, isSameDay, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarAppointment, DayPayment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { DayMiniTimeline } from "./DayMiniTimeline";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import type { DayBirthday } from "./BirthdaysStrip";
import { openWhatsApp } from "@/lib/whatsapp";
import {
  X, CalendarDays, CalendarPlus, CreditCard, Check, Clock,
  AlertTriangle, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DayDetailModalProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  appointments: CalendarAppointment[];
  dayPayments?: DayPayment[];
  birthdays?: DayBirthday[];
  clinicName?: string;
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onPaymentClick?: (payment: DayPayment) => void;
  onCreateAppointment: () => void;
  onCreatePayment: () => void;
  showProfessionalColors: boolean;
}

const CANCELLED = ["cancelled", "cancelled_by_patient"];

/**
 * El día completo en un modal (escritorio): fecha con color de marca,
 * mini línea del día, cumpleaños con globos, citas, pagos y acciones
 * grandes. Todo el detalle de un día, hasta lo exótico, en un lugar.
 */
export const DayDetailModal = ({
  open,
  onClose,
  selectedDate,
  appointments,
  dayPayments = [],
  birthdays = [],
  clinicName = "tu consultorio",
  onAppointmentClick,
  onPaymentClick,
  onCreateAppointment,
  onCreatePayment,
  showProfessionalColors,
}: DayDetailModalProps) => {
  const { primaryColor } = useDashboardBranding();
  const isCurrentDay = isToday(selectedDate);

  const dayAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => isSameDay(new Date(apt.start_at), selectedDate))
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [appointments, selectedDate]
  );
  const activeApts = dayAppointments.filter((a) => !CANCELLED.includes(a.status));
  const cancelledApts = dayAppointments.filter((a) => CANCELLED.includes(a.status));
  const doneCount = activeApts.filter((a) => a.status === "attended").length;
  const isEmpty = dayAppointments.length === 0 && dayPayments.length === 0 && birthdays.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto overflow-x-hidden p-0 gap-0">
        {/* ── Cabecera con color de marca ── */}
        <div
          className="relative p-5 sm:p-6 border-b"
          style={{
            background: `linear-gradient(160deg, hsla(${primaryColor}, 0.14) 0%, hsla(${primaryColor}, 0.04) 60%, transparent)`,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={cn(
                  "w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0",
                  !isCurrentDay && "bg-card border border-border/70"
                )}
                style={
                  isCurrentDay
                    ? {
                        background: `hsl(${primaryColor})`,
                        color: "#fff",
                        boxShadow: `0 10px 24px -10px hsla(${primaryColor}, 0.65)`,
                      }
                    : undefined
                }
              >
                <span className="text-[10px] font-bold uppercase tracking-wide leading-none opacity-80">
                  {format(selectedDate, "EEE", { locale: es })}
                </span>
                <span className="text-2xl font-extrabold leading-none mt-1">
                  {format(selectedDate, "d")}
                </span>
              </div>
              <div className="min-w-0">
                <DialogTitle className="capitalize text-xl leading-tight">
                  {isCurrentDay ? "Hoy" : format(selectedDate, "EEEE d", { locale: es })}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1 tabular-nums">
                    <Clock className="h-3 w-3" />
                    {activeApts.length} sesion{activeApts.length !== 1 ? "es" : ""}
                  </span>
                  {doneCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-1">
                      <Check className="h-3 w-3" />
                      {doneCount} realizada{doneCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  {cancelledApts.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/60 border border-border/50 rounded-full px-2.5 py-1">
                      <X className="h-3 w-3 text-rose-400" />
                      {cancelledApts.length} cancelada{cancelledApts.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {dayPayments.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-2.5 py-1">
                      <CreditCard className="h-3 w-3" />
                      {dayPayments.length} pago{dayPayments.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* El día en miniatura */}
          <DayMiniTimeline
            appointments={dayAppointments}
            showProfessionalColors={showProfessionalColors}
            isCurrentDay={isCurrentDay}
            className="mt-4"
          />
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* 🎂 Cumpleaños del día */}
          {birthdays.length > 0 && (
            <div
              className="relative overflow-hidden rounded-2xl border border-pink-300/50 dark:border-pink-500/25 p-4"
              style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(168,85,247,0.06))" }}
            >
              <style>{`
                @keyframes modalBdayFloat {
                  0%, 100% { transform: translateY(0) rotate(-4deg); }
                  50% { transform: translateY(-10px) rotate(5deg); }
                }
                @media (prefers-reduced-motion: reduce) { .modal-bday { animation: none !important; } }
              `}</style>
              {["🎈", "🎉", "🎈", "🎊"].map((e, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="modal-bday absolute text-lg pointer-events-none select-none"
                  style={{
                    right: `${6 + i * 12}%`,
                    top: i % 2 === 0 ? "10%" : "45%",
                    animation: `modalBdayFloat ${3.4 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
                  }}
                >
                  {e}
                </span>
              ))}
              <div className="relative space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-pink-600 dark:text-pink-300">
                  🎂 Día de cumpleaños
                </p>
                {birthdays.map((b) => (
                  <div key={b.id} className="flex items-center gap-2.5 flex-wrap">
                    <p className="text-[15px] font-bold text-foreground">
                      ¡{isCurrentDay ? "Hoy cumple" : "Cumple"} {b.name}
                      {b.age != null && b.age > 0 && b.age < 120 ? ` (${b.age})` : ""}! 🥳
                    </p>
                    {b.phone && (
                      <button
                        type="button"
                        onClick={() =>
                          openWhatsApp(
                            b.phone!,
                            `¡Feliz cumpleaños, ${b.name.trim().split(/\s+/)[0]}! 🎂 Que tengas un día hermoso. Un abrazo del equipo de ${clinicName}.`
                          )
                        }
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-[#25D366]/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition-colors hover:bg-[#25D366]/25"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Mandar saludo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones grandes */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button onClick={onCreateAppointment} className="h-12 rounded-xl gap-2 font-bold text-[15px]">
              <CalendarPlus className="h-4 w-4" />
              Nueva cita
            </Button>
            <Button variant="outline" onClick={onCreatePayment} className="h-12 rounded-xl gap-2 font-semibold text-[15px]">
              <CreditCard className="h-4 w-4" />
              Registrar pago
            </Button>
          </div>

          {isEmpty ? (
            <div className="flex flex-col items-center py-10 gap-1.5 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-1.5">
                <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-foreground/80">Día libre 🙌</p>
              <p className="text-sm text-muted-foreground">Sin citas ni pagos este día.</p>
            </div>
          ) : (
            <>
              {/* Citas del día */}
              {activeApts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Citas
                  </h4>
                  <div className="space-y-2.5">
                    {activeApts.map((apt, i) => (
                      <div
                        key={apt.id}
                        className="animate-in fade-in slide-in-from-bottom-2"
                        style={{
                          animationDelay: `${Math.min(i * 45, 350)}ms`,
                          animationDuration: "350ms",
                          animationFillMode: "both",
                        }}
                      >
                        <AppointmentCard
                          appointment={apt}
                          onClick={() => onAppointmentClick(apt)}
                          showProfessionalColor={showProfessionalColors}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Canceladas: chips discretos */}
              {cancelledApts.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {cancelledApts.map((apt) => (
                    <button
                      key={apt.id}
                      onClick={() => onAppointmentClick(apt)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3 w-3 text-rose-400" />
                      <span className="tabular-nums">{format(new Date(apt.start_at), "HH:mm")}</span>
                      <span className="line-through truncate max-w-[10rem]">
                        {apt.patients?.full_name || "Sin paciente"}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pagos del día */}
              {dayPayments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Pagos
                  </h4>
                  <div className="space-y-2">
                    {dayPayments.map((payment) => {
                      const payStatus = calculatePaymentStatus({
                        due_date: payment.due_date,
                        paid_at: payment.paid_at,
                        status: payment.status,
                      });
                      const isOverdue = payStatus === "overdue";
                      const isDueSoon = payStatus === "due_soon";
                      return (
                        <button
                          key={payment.id}
                          type="button"
                          onClick={() => onPaymentClick?.(payment)}
                          className={cn(
                            "w-full p-3.5 rounded-xl border-l-4 text-left transition-all hover:shadow-md min-h-[56px]",
                            isOverdue && "bg-rose-500/5 border-l-rose-500",
                            isDueSoon && "bg-amber-500/5 border-l-amber-500",
                            !isOverdue && !isDueSoon && "bg-emerald-500/5 border-l-emerald-500"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{payment.patient_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                {formatCurrency(payment.amount, "UYU")}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 shrink-0",
                                isOverdue && "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                                isDueSoon && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                !isOverdue && !isDueSoon && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {isOverdue ? "Vencido" : isDueSoon ? "Por vencer" : "Pendiente"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

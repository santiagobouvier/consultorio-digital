import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CalendarAppointment, DayPayment } from "./types";
import { AppointmentCard } from "./AppointmentCard";
import { DayMiniTimeline } from "./DayMiniTimeline";
import { useDashboardBranding } from "@/contexts/DashboardBrandingContext";
import { X, CreditCard, CalendarDays, ChevronLeft, ChevronRight, CalendarPlus, Coffee, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculatePaymentStatus, formatCurrency } from "@/lib/payments";
import { isToday } from "date-fns";
import type { DayBirthday } from "./BirthdaysStrip";
import { openWhatsApp } from "@/lib/whatsapp";
import { MessageCircle } from "lucide-react";

interface MonthDayDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  appointments: CalendarAppointment[];
  dayPayments?: DayPayment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onPaymentClick?: (payment: DayPayment) => void;
  showProfessionalColors: boolean;
  /** Cumpleaños de pacientes en este día. */
  birthdays?: DayBirthday[];
  clinicName?: string;
  /** Ir al día anterior/siguiente sin salir del panel. */
  onNavigateDay?: (delta: 1 | -1) => void;
  onCreateAppointment?: () => void;
  onCreatePayment?: () => void;
  onCreatePersonal?: () => void;
  onQuickBlock?: () => void;
}

export const MonthDayDrawer = ({
  open,
  onClose,
  selectedDate,
  appointments,
  dayPayments = [],
  onAppointmentClick,
  onPaymentClick,
  showProfessionalColors,
  birthdays = [],
  clinicName = "tu consultorio",
  onNavigateDay,
  onCreateAppointment,
  onCreatePayment,
  onCreatePersonal,
  onQuickBlock,
}: MonthDayDrawerProps) => {
  const dayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.start_at), selectedDate))
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, selectedDate]);

  const totalCount = dayAppointments.length + dayPayments.length;
  const { primaryColor } = useDashboardBranding();
  const isCurrentDay = isToday(selectedDate);
  const activeCount = dayAppointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "cancelled_by_patient"
  ).length;

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader
          className="border-b pb-4"
          style={{
            background: `linear-gradient(160deg, hsla(${primaryColor}, 0.12) 0%, hsla(${primaryColor}, 0.03) 60%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "w-[52px] h-[52px] rounded-2xl flex flex-col items-center justify-center shrink-0",
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
                <span className="text-[9px] font-bold uppercase tracking-wide leading-none opacity-80">
                  {format(selectedDate, "EEE", { locale: es })}
                </span>
                <span className="text-xl font-extrabold leading-none mt-1">
                  {format(selectedDate, "d")}
                </span>
              </div>
              <div className="min-w-0 text-left">
                <DrawerTitle className="capitalize text-left text-lg leading-tight truncate">
                  {isCurrentDay ? "Hoy" : format(selectedDate, "EEEE d", { locale: es })}
                </DrawerTitle>
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, "d 'de' MMMM", { locale: es })}
                  {activeCount > 0 && ` · ${activeCount} sesion${activeCount !== 1 ? "es" : ""}`}
                  {dayPayments.length > 0 && ` · ${dayPayments.length} pago${dayPayments.length !== 1 ? "s" : ""}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onNavigateDay && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onNavigateDay(-1)}
                    className="rounded-full h-10 w-10"
                    aria-label="Día anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onNavigateDay(1)}
                    className="rounded-full h-10 w-10"
                    aria-label="Día siguiente"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* El día en miniatura */}
          <DayMiniTimeline
            appointments={dayAppointments}
            showProfessionalColors={showProfessionalColors}
            isCurrentDay={isCurrentDay}
            className="mt-3"
          />
        </DrawerHeader>

        <div className="overflow-y-auto p-4 pb-8 space-y-4">
          {/* 🎂 Cumpleaños del día */}
          {birthdays.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-pink-300/50 dark:border-pink-500/25 p-4"
              style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(168,85,247,0.06))" }}
            >
              <style>{`
                @keyframes drawerBdayFloat {
                  0%, 100% { transform: translateY(0) rotate(-4deg); }
                  50% { transform: translateY(-10px) rotate(5deg); }
                }
                @media (prefers-reduced-motion: reduce) { .drawer-bday { animation: none !important; } }
              `}</style>
              {["🎈", "🎉", "🎈"].map((e, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="drawer-bday absolute text-lg pointer-events-none select-none"
                  style={{
                    right: `${8 + i * 16}%`,
                    top: i % 2 === 0 ? "10%" : "45%",
                    animation: `drawerBdayFloat ${3.4 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
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
                      ¡Cumple {b.name}
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
                        Saludar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Crear cualquier cosa para ESTE día, de entrada */}
          {(onCreateAppointment || onCreatePayment || onCreatePersonal || onQuickBlock) && (
            <div className="grid grid-cols-2 gap-2">
              {onCreateAppointment && (
                <Button onClick={onCreateAppointment} className="h-12 rounded-xl gap-2 font-bold text-[15px]">
                  <CalendarPlus className="h-4 w-4" />
                  Nueva cita
                </Button>
              )}
              {onCreatePayment && (
                <Button variant="outline" onClick={onCreatePayment} className="h-12 rounded-xl gap-2 font-semibold text-[15px]">
                  <CreditCard className="h-4 w-4" />
                  Registrar pago
                </Button>
              )}
              {onCreatePersonal && (
                <Button variant="outline" onClick={onCreatePersonal} className="h-12 rounded-xl gap-2 font-semibold text-[15px]">
                  <Coffee className="h-4 w-4 text-slate-500" />
                  Evento personal
                </Button>
              )}
              {onQuickBlock && (
                <Button
                  variant="outline"
                  onClick={onQuickBlock}
                  className="h-12 rounded-xl gap-2 font-semibold text-[15px] border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <CalendarOff className="h-4 w-4" />
                  Imprevisto
                </Button>
              )}
            </div>
          )}

          {dayAppointments.length === 0 && dayPayments.length === 0 ? (
            <div className="flex flex-col items-center py-8 gap-1.5 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-1.5">
                <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-foreground/80">Día libre 🙌</p>
              <p className="text-sm text-muted-foreground">Creá lo que necesites con los botones de arriba.</p>
            </div>
          ) : (
            <>
              {dayAppointments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Citas
                  </h4>
                  <div className="space-y-3">
                    {dayAppointments.map((apt, i) => (
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

              {dayPayments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1 flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pagos y vencimientos
                  </h4>
                  <div className="space-y-2">
                    {dayPayments.map((p) => {
                      const st = calculatePaymentStatus(p);
                      const initials = (p.patient_name?.trim().split(/\s+/).map((x) => x[0]).slice(0, 2).join("") || "?").toUpperCase();
                      return (
                        <button
                          key={p.id}
                          onClick={() => onPaymentClick?.(p)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border-l-4 transition-all hover:shadow-md active:scale-[0.99]",
                            st === "overdue" && "bg-rose-50 dark:bg-rose-950/30 border-l-rose-500",
                            st === "due_soon" && "bg-amber-50 dark:bg-amber-950/30 border-l-amber-500",
                            st !== "overdue" && st !== "due_soon" && "bg-emerald-50 dark:bg-emerald-950/30 border-l-emerald-500"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarImage src={p.patient_avatar_url || undefined} alt={p.patient_name} />
                              <AvatarFallback className="text-xs font-semibold bg-background">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">{p.patient_name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatCurrency(p.amount, p.currency)}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "rounded-full text-xs shrink-0",
                                st === "overdue" && "border-rose-300 text-rose-700 dark:text-rose-400",
                                st === "due_soon" && "border-amber-300 text-amber-700 dark:text-amber-400"
                              )}
                            >
                              {st === "overdue" ? "Vencido" : st === "due_soon" ? "Por vencer" : "Pendiente"}
                            </Badge>
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
      </DrawerContent>
    </Drawer>
  );
};

import { useState, useMemo } from "react";
import { isSameDay } from "date-fns";
import { CalendarAppointment, DayPayment } from "./types";
import { DesktopDaySidebar } from "./DesktopDaySidebar";
import { MonthViewV2 } from "./MonthViewV2";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface DesktopCalendarLayoutProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onCreateAppointment: (date?: Date) => void;
  onCreatePayment: (date?: Date) => void;
  showProfessionalColors: boolean;
  paymentsByDay?: Map<string, DayPayment[]>;
  onPaymentClick?: (payment: DayPayment) => void;
}

export const DesktopCalendarLayout = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onCreateAppointment,
  onCreatePayment,
  showProfessionalColors,
  paymentsByDay,
  onPaymentClick,
}: DesktopCalendarLayoutProps) => {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true); // Start open to show the panel

  const handleDayClick = (date: Date) => {
    if (selectedDay && isSameDay(date, selectedDay)) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSelectedDay(date);
      setSidebarOpen(true);
    }
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
    setSelectedDay(null);
  };

  // Get day indicators for month view
  const dayIndicators = useMemo(() => {
    const indicators = new Map<string, { count: number; hasOverdue: boolean; hasPending: boolean }>();

    appointments.forEach(apt => {
      const dateKey = new Date(apt.start_at).toDateString();
      const current = indicators.get(dateKey) || { count: 0, hasOverdue: false, hasPending: false };

      indicators.set(dateKey, {
        count: current.count + 1,
        hasOverdue: current.hasOverdue || apt.paymentColor === "red",
        hasPending: current.hasPending || apt.paymentColor === "orange",
      });
    });

    return indicators;
  }, [appointments]);

  const selectedDayPayments = useMemo(() => {
    if (!selectedDay || !paymentsByDay) return [];
    return paymentsByDay.get(selectedDay.toDateString()) || [];
  }, [selectedDay, paymentsByDay]);

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Calendar area */}
      <div className={cn(
        "transition-all duration-300 ease-out min-w-0",
        sidebarOpen ? "flex-1" : "w-full"
      )}>
        <MonthViewV2
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={onAppointmentClick}
          onDayClick={handleDayClick}
          onAddAppointment={() => onCreateAppointment()}
          showProfessionalColors={showProfessionalColors}
          isDesktop
          selectedDay={selectedDay}
          dayIndicators={dayIndicators}
          paymentsByDay={paymentsByDay}
          onPaymentClick={onPaymentClick}
        />
      </div>

      {/* Side panel container with attached toggle */}
      <div className="relative shrink-0 flex">
        {/* Toggle tab — always visible, attached to sidebar edge */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={cn(
            "self-center -mr-px h-16 w-6 rounded-l-lg border border-r-0 bg-card hover:bg-muted",
            "flex items-center justify-center transition-colors shadow-sm z-10"
          )}
          aria-label={sidebarOpen ? "Ocultar panel del día" : "Mostrar panel del día"}
        >
          <ChevronRight
            className={cn(
              "w-4 h-4 text-muted-foreground transition-transform duration-300",
              sidebarOpen ? "rotate-0" : "rotate-180"
            )}
          />
        </button>

        {/* Side panel */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-out rounded-r-2xl shadow-lg",
          sidebarOpen
            ? "w-[380px] opacity-100 border bg-card"
            : "w-0 opacity-0"
        )}>
          {sidebarOpen && (
            <DesktopDaySidebar
              selectedDate={selectedDay}
              appointments={appointments}
              dayPayments={selectedDayPayments}
              onAppointmentClick={(apt) => {
                onAppointmentClick(apt);
              }}
              onPaymentClick={(p) => onPaymentClick?.(p)}
              onCreateAppointment={() => onCreateAppointment(selectedDay || undefined)}
              onCreatePayment={() => onCreatePayment(selectedDay || undefined)}
              onClose={handleCloseSidebar}
              showProfessionalColors={showProfessionalColors}
            />
          )}
        </div>
      </div>
    </div>
  );
};

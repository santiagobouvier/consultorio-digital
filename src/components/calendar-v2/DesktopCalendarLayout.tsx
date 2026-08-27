import { useMemo } from "react";
import { CalendarAppointment, DayPayment } from "./types";
import { MonthViewV2 } from "./MonthViewV2";
import type { DayBirthday } from "./BirthdaysStrip";

interface DesktopCalendarLayoutProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onCreateAppointment: (date?: Date) => void;
  onDayClick: (date: Date) => void;
  showProfessionalColors: boolean;
  paymentsByDay?: Map<string, DayPayment[]>;
  onPaymentClick?: (payment: DayPayment) => void;
  birthdaysByDate?: Map<string, DayBirthday[]>;
  clinicName?: string;
}

export const DesktopCalendarLayout = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onCreateAppointment,
  onDayClick,
  showProfessionalColors,
  paymentsByDay,
  onPaymentClick,
  birthdaysByDate,
  clinicName,
}: DesktopCalendarLayoutProps) => {
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

  return (
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      {/* Calendar area — tocar un día abre EL DÍA COMPLETO (vista Día,
          grilla horaria estilo Google Calendar), igual que en mobile */}
      <div className="w-full min-w-0">
        <MonthViewV2
          currentDate={currentDate}
          appointments={appointments}
          onAppointmentClick={onAppointmentClick}
          onDayClick={onDayClick}
          onAddAppointment={() => onCreateAppointment()}
          showProfessionalColors={showProfessionalColors}
          isDesktop
          selectedDay={null}
          dayIndicators={dayIndicators}
          paymentsByDay={paymentsByDay}
          onPaymentClick={onPaymentClick}
          birthdaysByDate={birthdaysByDate}
          clinicName={clinicName}
        />
      </div>
    </div>
  );
};

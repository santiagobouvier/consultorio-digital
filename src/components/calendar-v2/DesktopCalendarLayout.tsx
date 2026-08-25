import { useState, useMemo } from "react";
import { CalendarAppointment, DayPayment } from "./types";
import { DayDetailModal } from "./DayDetailModal";
import { MonthViewV2 } from "./MonthViewV2";
import type { DayBirthday } from "./BirthdaysStrip";

interface DesktopCalendarLayoutProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onCreateAppointment: (date?: Date) => void;
  onCreatePayment: (date?: Date) => void;
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
  onCreatePayment,
  showProfessionalColors,
  paymentsByDay,
  onPaymentClick,
  birthdaysByDate,
  clinicName,
}: DesktopCalendarLayoutProps) => {
  // Tocar un día abre EL DÍA COMPLETO en un modal (impacto > panel lateral)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);

  const handleDayClick = (date: Date) => {
    setSelectedDay(date);
    setDayModalOpen(true);
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
    <div className="h-[calc(100vh-200px)] min-h-[600px]">
      {/* Calendar area */}
      <div className="w-full min-w-0">
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
          birthdaysByDate={birthdaysByDate}
          clinicName={clinicName}
        />
      </div>

      {/* El día completo, en modal */}
      {selectedDay && (
        <DayDetailModal
          open={dayModalOpen}
          onClose={() => setDayModalOpen(false)}
          selectedDate={selectedDay}
          appointments={appointments}
          dayPayments={selectedDayPayments}
          birthdays={birthdaysByDate?.get(selectedDay.toDateString()) ?? []}
          clinicName={clinicName}
          onAppointmentClick={(apt) => {
            setDayModalOpen(false);
            onAppointmentClick(apt);
          }}
          onPaymentClick={(p) => {
            setDayModalOpen(false);
            onPaymentClick?.(p);
          }}
          onCreateAppointment={() => {
            setDayModalOpen(false);
            onCreateAppointment(selectedDay || undefined);
          }}
          onCreatePayment={() => {
            setDayModalOpen(false);
            onCreatePayment(selectedDay || undefined);
          }}
          showProfessionalColors={showProfessionalColors}
        />
      )}
    </div>
  );
};

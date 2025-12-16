import { useState, useMemo } from "react";
import { isSameDay } from "date-fns";
import { CalendarAppointment } from "./types";
import { DesktopDaySidebar } from "./DesktopDaySidebar";
import { MonthViewV2 } from "./MonthViewV2";
import { cn } from "@/lib/utils";

interface DesktopCalendarLayoutProps {
  currentDate: Date;
  appointments: CalendarAppointment[];
  onAppointmentClick: (appointment: CalendarAppointment) => void;
  onCreateAppointment: (date?: Date) => void;
  onCreatePayment: (date?: Date) => void;
  showProfessionalColors: boolean;
}

export const DesktopCalendarLayout = ({
  currentDate,
  appointments,
  onAppointmentClick,
  onCreateAppointment,
  onCreatePayment,
  showProfessionalColors,
}: DesktopCalendarLayoutProps) => {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleDayClick = (date: Date) => {
    // If clicking same day, toggle sidebar
    if (selectedDay && isSameDay(date, selectedDay)) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSelectedDay(date);
      setSidebarOpen(true);
    }
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
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

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Calendar area */}
      <div className={cn(
        "flex-1 transition-all duration-300 ease-out",
        sidebarOpen ? "w-[calc(100%-380px)]" : "w-full"
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
        />
      </div>

      {/* Side panel */}
      <div className={cn(
        "shrink-0 overflow-hidden transition-all duration-300 ease-out border rounded-2xl bg-card shadow-lg",
        sidebarOpen ? "w-[360px] opacity-100" : "w-0 opacity-0 border-0"
      )}>
        {sidebarOpen && (
          <DesktopDaySidebar
            selectedDate={selectedDay}
            appointments={appointments}
            onAppointmentClick={(apt) => {
              onAppointmentClick(apt);
            }}
            onCreateAppointment={() => onCreateAppointment(selectedDay || undefined)}
            onCreatePayment={() => onCreatePayment(selectedDay || undefined)}
            onClose={handleCloseSidebar}
            showProfessionalColors={showProfessionalColors}
          />
        )}
      </div>
    </div>
  );
};

import { useState, useMemo } from "react";
import { isSameDay } from "date-fns";
import { CalendarAppointment } from "./types";
import { DesktopDaySidebar } from "./DesktopDaySidebar";
import { MonthViewV2 } from "./MonthViewV2";
import { cn } from "@/lib/utils";
import { Calendar, ChevronRight } from "lucide-react";

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

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
      {/* Calendar area */}
      <div className={cn(
        "transition-all duration-300 ease-out",
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
        />
      </div>

      {/* Side panel - always visible container */}
      <div className={cn(
        "shrink-0 overflow-hidden transition-all duration-300 ease-out rounded-2xl shadow-lg",
        sidebarOpen 
          ? "w-[380px] opacity-100 border bg-card" 
          : "w-0 opacity-0"
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

      {/* Toggle button when closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 bg-card border border-r-0 rounded-l-xl p-2 shadow-lg hover:bg-muted transition-colors z-10"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground rotate-180" />
        </button>
      )}
    </div>
  );
};

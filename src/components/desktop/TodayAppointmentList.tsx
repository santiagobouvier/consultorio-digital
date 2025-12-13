import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Clock, DollarSign, Check, AlertTriangle, Calendar, Video, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarAppointment, PaymentColor } from "@/components/calendar-v2/types";

interface TodayAppointmentListProps {
  appointments: CalendarAppointment[];
  upcomingAppointments: CalendarAppointment[];
  onAppointmentClick: (apt: CalendarAppointment) => void;
  showProfessionalColors: boolean;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendiente", variant: "secondary" },
  confirmed: { label: "Confirmada", variant: "default" },
  attended: { label: "Atendida", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "destructive" },
  no_show: { label: "Ausente", variant: "destructive" },
};

const paymentConfig: Record<PaymentColor, { icon: any; color: string; label: string }> = {
  green: { icon: Check, color: "text-success", label: "Al día" },
  orange: { icon: AlertTriangle, color: "text-warning", label: "Por vencer" },
  red: { icon: AlertTriangle, color: "text-destructive", label: "Vencido" },
  gray: { icon: DollarSign, color: "text-muted-foreground", label: "Sin pagos" },
};

const AppointmentItem = ({ 
  apt, 
  onClick, 
  showProfessionalColor 
}: { 
  apt: CalendarAppointment; 
  onClick: () => void;
  showProfessionalColor: boolean;
}) => {
  const paymentInfo = paymentConfig[apt.paymentColor || "gray"];
  const PaymentIcon = paymentInfo?.icon || DollarSign;
  const statusInfo = statusConfig[apt.status] || { label: apt.status, variant: "secondary" as const };
  const isNow = new Date() >= new Date(apt.start_at) && new Date() <= new Date(apt.end_at);
  
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-3 cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] border-l-4",
        isNow && "ring-2 ring-primary/30 bg-primary/5",
        apt.status === "attended" && "opacity-60"
      )}
      style={{
        borderLeftColor: showProfessionalColor 
          ? apt.professional?.color || "#00b5b5"
          : "hsl(var(--primary))",
      }}
    >
      {/* Time and Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">
            {format(new Date(apt.start_at), "HH:mm")}
          </span>
          {isNow && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
              AHORA
            </Badge>
          )}
        </div>
        <Badge variant={statusInfo.variant} className="text-[10px] px-1.5 py-0 h-4">
          {statusInfo.label}
        </Badge>
      </div>

      {/* Patient Name */}
      <p className="font-medium text-sm truncate mb-1.5">
        {apt.patients?.full_name || "Sin paciente"}
      </p>

      {/* Service and Payment Status */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate flex-1">
          {apt.modality === "online" ? (
            <Video className="h-3 w-3 shrink-0" />
          ) : (
            <MapPin className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">
            {apt.services?.name || (apt.modality === "online" ? "Online" : "Presencial")}
          </span>
        </div>
        <div className={cn("flex items-center gap-1 shrink-0", paymentInfo?.color)}>
          <PaymentIcon className="h-3 w-3" />
          <span className="text-[10px]">{paymentInfo?.label}</span>
        </div>
      </div>

      {/* Professional name if shared calendar */}
      {showProfessionalColor && apt.professional && (
        <div className="mt-2 pt-2 border-t">
          <span className="text-[10px] text-muted-foreground">
            {apt.professional.name}
          </span>
        </div>
      )}
    </Card>
  );
};

export const TodayAppointmentList = ({
  appointments,
  upcomingAppointments,
  onAppointmentClick,
  showProfessionalColors,
}: TodayAppointmentListProps) => {
  return (
    <div className="p-4 space-y-6">
      {/* Today's appointments */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Citas de hoy
        </h3>
        {appointments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin citas programadas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt) => (
              <AppointmentItem
                key={apt.id}
                apt={apt}
                onClick={() => onAppointmentClick(apt)}
                showProfessionalColor={showProfessionalColors}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming appointments */}
      {upcomingAppointments.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Próximas citas
          </h3>
          <div className="space-y-2">
            {upcomingAppointments.map((apt) => (
              <Card
                key={apt.id}
                onClick={() => onAppointmentClick(apt)}
                className="p-2.5 cursor-pointer transition-all hover:shadow-sm hover:bg-muted/50 border-l-4"
                style={{
                  borderLeftColor: showProfessionalColors 
                    ? apt.professional?.color || "#00b5b5"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {format(new Date(apt.start_at), "EEE d", { locale: es })}
                  </span>
                  <span className="font-medium">
                    {format(new Date(apt.start_at), "HH:mm")}
                  </span>
                </div>
                <p className="text-sm font-medium truncate mt-1">
                  {apt.patients?.full_name || "Sin paciente"}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

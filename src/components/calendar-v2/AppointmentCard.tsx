import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { CalendarAppointment, APPOINTMENT_STATUS_MAP, getPaymentColorInfo } from "./types";
import { Video, MapPin } from "lucide-react";

const getInitials = (name?: string | null) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
};

interface AppointmentCardProps {
  appointment: CalendarAppointment;
  onClick: () => void;
  showProfessionalColor?: boolean;
  compact?: boolean;
}

export const AppointmentCard = ({
  appointment,
  onClick,
  showProfessionalColor = false,
  compact = false,
}: AppointmentCardProps) => {
  const statusInfo = APPOINTMENT_STATUS_MAP[appointment.status];
  const paymentInfo = getPaymentColorInfo(appointment.paymentColor);
  const professionalColor = appointment.professional?.color || "#00b5b5";

  const formatTime = (datetime: string) => format(new Date(datetime), "HH:mm");

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left p-2.5 rounded-xl bg-card border transition-all duration-200",
          "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]",
          showProfessionalColor && "border-l-4"
        )}
        style={{
          borderLeftColor: showProfessionalColor ? professionalColor : undefined,
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={appointment.patients?.avatar_url || undefined} alt={appointment.patients?.full_name || ""} />
            <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
              {getInitials(appointment.patients?.full_name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-bold text-primary">
            {formatTime(appointment.start_at)}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            {paymentInfo && (
              <span className={cn("w-2 h-2 rounded-full shrink-0", paymentInfo.className)} />
            )}
            <Badge
              variant={statusInfo?.variant || "outline"}
              className="rounded-full text-[10px] px-2 py-0"
            >
              {statusInfo?.label || appointment.status}
            </Badge>
          </div>
        </div>
        <p className="text-sm font-medium truncate">
          {appointment.patients?.full_name || "Sin paciente"}
        </p>
        {appointment.services?.name && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {appointment.services.name}
          </p>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-2xl bg-card border transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.97] active:shadow-sm",
        showProfessionalColor && "border-l-4"
      )}
      style={{
        borderLeftColor: showProfessionalColor ? professionalColor : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          {/* Time */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-primary">
              {formatTime(appointment.start_at)} - {formatTime(appointment.end_at)}
            </span>
          </div>

          {/* Patient */}
          <div className="flex items-center gap-2">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={appointment.patients?.avatar_url || undefined} alt={appointment.patients?.full_name || ""} />
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {getInitials(appointment.patients?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">
                {appointment.patients?.full_name || "Sin paciente"}
              </p>
              {appointment.services?.name && (
                <p className="text-sm text-muted-foreground truncate">
                  {appointment.services.name}
                </p>
              )}
            </div>
          </div>

          {/* Modality & Location */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {appointment.modality === "online" ? (
              <span className="flex items-center gap-1">
                <Video className="h-3.5 w-3.5" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Presencial
              </span>
            )}
            {appointment.location && (
              <span className="truncate">{appointment.location}</span>
            )}
          </div>

          {/* Professional name if shown */}
          {showProfessionalColor && appointment.professional && (
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: professionalColor }}
              />
              <span className="text-xs text-muted-foreground">
                {appointment.professional.name}
              </span>
            </div>
          )}
        </div>

        {/* Status badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge
            variant={statusInfo?.variant || "outline"}
            className="rounded-full"
          >
            {statusInfo?.label || appointment.status}
          </Badge>
          {paymentInfo && (
            <Badge variant="outline" className="rounded-full text-xs flex items-center gap-1">
              <span className={cn("w-1.5 h-1.5 rounded-full", paymentInfo.className)} />
              {paymentInfo.label}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
};

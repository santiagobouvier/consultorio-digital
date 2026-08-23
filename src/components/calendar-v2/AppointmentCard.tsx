import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { CalendarAppointment, APPOINTMENT_STATUS_MAP, getPaymentColorInfo, getStatusColor } from "./types";
import { Video, MapPin, Repeat, Coffee } from "lucide-react";

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
  const statusColor = getStatusColor(appointment.status);

  const formatTime = (datetime: string) => format(new Date(datetime), "HH:mm");

  const isRecurrent = !!(appointment as any).recurrence_group_id;

  // Evento personal: bloque gris con título, sin paciente/pago/modalidad.
  if (appointment.isPersonal) {
    const isWeekly = appointment.personalEvent?.recurrence === "weekly";
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-xl border border-dashed border-slate-300 dark:border-slate-600",
          "bg-slate-100/70 dark:bg-slate-500/10 transition-all duration-200",
          "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]",
          compact ? "p-2.5" : "p-4"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-500/20">
            <Coffee className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
          </span>
          <span className={cn("font-bold text-slate-600 dark:text-slate-300", compact ? "text-sm" : "text-base")}>
            {formatTime(appointment.start_at)} - {formatTime(appointment.end_at)}
          </span>
          <div className="flex items-center gap-1 ml-auto">
            {isWeekly && <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />}
            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0">
              Personal
            </Badge>
          </div>
        </div>
        <p className={cn("font-medium truncate text-foreground/85", compact ? "text-sm mt-1" : "text-[15px] mt-1.5")}>
          {appointment.personalEvent?.title || "Evento personal"}
        </p>
        {!compact && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Nadie puede reservar en este horario.
          </p>
        )}
      </button>
    );
  }

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left p-2.5 rounded-xl bg-card border transition-all duration-200",
          "hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97]",
          "border-l-4",
          !showProfessionalColor && statusColor.border
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
            {isRecurrent && (
              <Repeat className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
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
        "border-l-4",
        !showProfessionalColor && statusColor.border
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
          {isRecurrent && (
            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
          )}
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

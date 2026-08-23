// El día entero dibujado en una barrita: cada evento es un segmento con su
// color real (etiqueta / profesional / estado) sobre el riel horario.
// Es la firma visual de "abrir un día": de un vistazo se ve la forma del día.
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CalendarAppointment, getEventHexColor } from "./types";

const CANCELLED = ["cancelled", "cancelled_by_patient"];

interface DayMiniTimelineProps {
  appointments: CalendarAppointment[]; // las del día (se filtran canceladas)
  showProfessionalColors: boolean;
  isCurrentDay?: boolean;
  className?: string;
}

export const DayMiniTimeline = ({
  appointments,
  showProfessionalColors,
  isCurrentDay = false,
  className,
}: DayMiniTimelineProps) => {
  const active = useMemo(
    () => appointments.filter((a) => !CANCELLED.includes(a.status)),
    [appointments]
  );

  const { startHour, endHour } = useMemo(() => {
    let s = 7;
    let e = 21;
    for (const a of active) {
      const sD = new Date(a.start_at);
      const eD = new Date(a.end_at);
      s = Math.min(s, sD.getHours());
      e = Math.max(e, eD.getMinutes() > 0 ? eD.getHours() + 1 : eD.getHours());
    }
    return { startHour: s, endHour: Math.min(e, 24) };
  }, [active]);

  if (active.length === 0) return null;

  const spanMin = (endHour - startHour) * 60;
  const pct = (d: Date) =>
    Math.min(Math.max(((d.getHours() * 60 + d.getMinutes() - startHour * 60) / spanMin) * 100, 0), 100);

  const now = new Date();
  const nowPct = pct(now);
  const showNow = isCurrentDay && now.getHours() >= startHour && now.getHours() < endHour;
  const midHour = Math.round((startHour + endHour) / 2);

  return (
    <div className={cn("select-none", className)}>
      <div className="relative h-3 rounded-full bg-foreground/[0.08] overflow-hidden">
        {active.map((apt) => {
          const s = new Date(apt.start_at);
          const e = new Date(apt.end_at);
          const left = pct(s);
          const width = Math.max(pct(e) - left, 1.8);
          return (
            <div
              key={apt.id}
              className="absolute top-0 bottom-0 rounded-full"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                background: getEventHexColor(apt, showProfessionalColors),
                opacity: apt.status === "attended" ? 0.45 : 0.95,
              }}
            />
          );
        })}
        {showNow && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-destructive z-10 rounded-full"
            style={{ left: `${nowPct}%` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[9px] font-medium text-muted-foreground/70 tabular-nums">
        <span>{String(startHour).padStart(2, "0")}:00</span>
        <span>{String(midHour).padStart(2, "0")}:00</span>
        <span>{String(endHour).padStart(2, "0")}:00</span>
      </div>
    </div>
  );
};

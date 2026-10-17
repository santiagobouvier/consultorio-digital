import { Bell, CalendarCheck, CalendarX, RefreshCw, XCircle, CreditCard, CalendarPlus, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { usePatientNotifications } from "@/hooks/use-patient-notifications";

const typeIcon = (type: string) => {
  switch (type) {
    case "appointment_confirmed":
      return <CalendarCheck className="h-4 w-4 text-primary" />;
    case "appointment_cancelled_by_professional":
      return <CalendarX className="h-4 w-4 text-destructive" />;
    case "reschedule_approved":
      return <RefreshCw className="h-4 w-4 text-primary" />;
    case "reschedule_rejected":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "payment_received":
      return <CreditCard className="h-4 w-4 text-primary" />;
    case "appointment_created_by_professional":
      return <CalendarPlus className="h-4 w-4 text-primary" />;
    case "payment_due_soon":
      return <Clock className="h-4 w-4 text-orange-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

interface Props {
  patientId: string;
}

export function NotificationsSummaryCard({ patientId }: Props) {
  const { notifications, unreadCount, markAllAsRead } = usePatientNotifications(patientId);

  const unread = notifications.filter((n) => !n.read_at).slice(0, 3);
  if (unreadCount === 0) return null;

  const more = unreadCount - unread.length;

  // Compacta: va después de próxima cita, reservar y pagos, sin empujarlos.
  return (
    <Card className="rounded-2xl border-primary/25 bg-primary/[0.04]" data-testid="portal-novedades">
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm lg:text-base font-semibold text-foreground m-0 truncate">
              {unreadCount === 1 ? "1 novedad sin leer" : `${unreadCount} novedades sin leer`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs lg:text-sm shrink-0"
            onClick={() => markAllAsRead()}
          >
            Marcar todo
          </Button>
        </div>
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/60">
          {unread.map((n) => (
            <li key={n.id} className="flex gap-3 items-start px-3 py-2.5 lg:px-4 lg:py-3">
              <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
              <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm lg:text-[15px] font-medium leading-snug m-0">{n.title}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground leading-snug mt-0.5 m-0">{n.body}</p>
                </div>
                <p className="text-[11px] lg:text-xs text-muted-foreground mt-1 sm:mt-0 m-0 shrink-0">
                  {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {more > 0 && (
          <p className="text-xs text-muted-foreground mt-2 m-0">
            {more === 1 ? "Y 1 más" : `Y ${more} más`} en la campana de arriba.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

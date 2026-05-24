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

  return (
    <Card className="rounded-2xl border-primary/30 bg-primary/5">
      <CardContent className="p-4 lg:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm lg:text-base font-semibold text-foreground">
                {unreadCount === 1
                  ? "Tenés 1 novedad sin leer"
                  : `Tenés ${unreadCount} novedades sin leer`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Actualizaciones de tus citas y pagos.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => markAllAsRead()}
          >
            Marcar todo
          </Button>
        </div>
        <ul className="space-y-2">
          {unread.map((n) => (
            <li
              key={n.id}
              className="flex gap-3 items-start rounded-xl bg-background/60 border border-border/60 p-3"
            >
              <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{n.title}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{n.body}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
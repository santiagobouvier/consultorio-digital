import { Bell, Check, CheckCheck, CalendarCheck, CalendarX, RefreshCw, XCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { usePatientNotifications, type PatientNotification } from "@/hooks/use-patient-notifications";
import { cn } from "@/lib/utils";

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
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
};

interface Props {
  patientId: string;
}

export function NotificationBell({ patientId }: Props) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = usePatientNotifications(patientId);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center rounded-full"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] sm:w-[380px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="font-semibold text-sm">Notificaciones</div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todo
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[60vh]">
          {notifications.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No tenés notificaciones todavía.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((n) => (
                <NotificationItem key={n.id} n={n} onMarkRead={markAsRead} />
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  n,
  onMarkRead,
}: {
  n: PatientNotification;
  onMarkRead: (id: string) => void;
}) {
  const unread = !n.read_at;
  return (
    <li
      className={cn(
        "px-4 py-3 flex gap-3 group transition-colors",
        unread ? "bg-primary/5" : "bg-transparent",
      )}
    >
      <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm leading-snug", unread ? "font-semibold" : "font-medium")}>
            {n.title}
          </p>
          {unread && (
            <button
              type="button"
              onClick={() => onMarkRead(n.id)}
              className="text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Marcar como leída"
              title="Marcar como leída"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: es })}
        </p>
      </div>
    </li>
  );
}
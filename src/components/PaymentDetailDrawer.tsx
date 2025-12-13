import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, CreditCard, RefreshCw, FileText, CheckCircle, User } from "lucide-react";
import {
  getPaymentStatusColor,
  getPaymentStatusLabel,
  formatCurrency,
  getRecurrenceTypeLabel,
  type PaymentStatus,
  type RecurrenceType,
  PAYMENT_METHODS,
} from "@/lib/payments";

interface PaymentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: {
    id: string;
    amount: number;
    currency: string;
    due_date: string;
    paid_at: string | null;
    status: PaymentStatus;
    recurrence_type: RecurrenceType;
    method: string | null;
    notes: string | null;
    patients?: {
      full_name: string;
      whatsapp_phone: string | null;
    };
  } | null;
  onEdit?: () => void;
  onMarkAsPaid?: () => void;
}

export function PaymentDetailDrawer({
  open,
  onOpenChange,
  payment,
  onEdit,
  onMarkAsPaid,
}: PaymentDetailDrawerProps) {
  if (!payment) return null;

  const methodLabel = payment.method
    ? PAYMENT_METHODS.find((m) => m.value === payment.method)?.label || payment.method
    : "No especificado";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle className="text-lg">Detalle del pago</DrawerTitle>
          <DrawerDescription>
            {payment.patients?.full_name || "Paciente"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4 overflow-y-auto">
          {/* Amount and Status */}
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold text-foreground">
              {formatCurrency(payment.amount, payment.currency)}
            </span>
            <Badge className={`${getPaymentStatusColor(payment.status)} rounded-full`}>
              {getPaymentStatusLabel(payment.status)}
            </Badge>
          </div>

          <Separator />

          {/* Details Grid */}
          <div className="space-y-3">
            {/* Patient */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paciente</p>
                <p className="text-sm font-medium text-foreground">
                  {payment.patients?.full_name || "No especificado"}
                </p>
              </div>
            </div>

            {/* Due Date */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha de vencimiento</p>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(payment.due_date), "EEEE d 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>
            </div>

            {/* Paid Date */}
            {payment.paid_at && (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha de pago</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(payment.paid_at), "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Método de pago</p>
                <p className="text-sm font-medium text-foreground">{methodLabel}</p>
              </div>
            </div>

            {/* Recurrence */}
            {payment.recurrence_type !== "one_time" && (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Recurrencia</p>
                  <p className="text-sm font-medium text-foreground">
                    {getRecurrenceTypeLabel(payment.recurrence_type)}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {payment.notes && (
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Notas</p>
                  <p className="text-sm text-foreground">{payment.notes}</p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {payment.status !== "paid" && payment.status !== "cancelled" && onMarkAsPaid && (
              <Button
                onClick={() => {
                  onMarkAsPaid();
                  onOpenChange(false);
                }}
                className="flex-1 rounded-xl"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Marcar pagado
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
                className="flex-1 rounded-xl"
              >
                Editar
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

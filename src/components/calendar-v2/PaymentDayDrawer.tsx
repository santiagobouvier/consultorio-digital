import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Check,
  Pencil,
  Trash2,
  X,
  ExternalLink,
  Calendar as CalendarIcon,
  StickyNote,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PaymentWhatsAppMenu } from "@/components/PaymentWhatsAppMenu";
import { PaymentForm } from "@/components/PaymentForm";
import {
  calculatePaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  formatCurrency,
} from "@/lib/payments";
import type { DayPayment } from "./types";

interface PaymentDayDrawerProps {
  open: boolean;
  onClose: () => void;
  payment: DayPayment | null;
  businessId: string;
  onUpdated: () => void;
}

export const PaymentDayDrawer = ({
  open,
  onClose,
  payment,
  businessId,
  onUpdated,
}: PaymentDayDrawerProps) => {
  const navigate = useNavigate();
  const [actionLoading, setActionLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  if (!payment) return null;

  const status = calculatePaymentStatus({
    due_date: payment.due_date,
    paid_at: payment.paid_at,
    status: payment.status,
  });

  const handleMarkPaid = async () => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("payments")
        .update({ paid_at: new Date().toISOString(), status: "paid" })
        .eq("id", payment.id);
      if (error) throw error;
      toast({ title: "Pago registrado", description: "Marcado como pagado." });
      onUpdated();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo marcar como pagado",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", payment.id);
      if (error) throw error;
      toast({ title: "Pago eliminado" });
      onUpdated();
      setShowDelete(false);
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "No se pudo eliminar el pago",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const goToPatient = () => {
    onClose();
    navigate(`/patients/${payment.patient_id}`);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-12 w-12 shrink-0 ring-2 ring-emerald-500/30">
                  <AvatarImage src={payment.patient_avatar_url || undefined} alt={payment.patient_name} />
                  <AvatarFallback className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">
                    {(payment.patient_name?.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DrawerTitle className="text-left text-lg truncate">
                    {payment.patient_name}
                  </DrawerTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" />
                    Detalle del pago
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DrawerHeader>

          <div className="overflow-y-auto p-5 space-y-5">
            {/* Amount + status */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Monto
                </p>
                <p className="text-3xl font-bold text-foreground tabular-nums">
                  {formatCurrency(payment.amount, payment.currency)}
                </p>
              </div>
              <Badge
                className={cn(
                  "rounded-full text-xs px-3 py-1",
                  getPaymentStatusColor(status)
                )}
              >
                {getPaymentStatusLabel(status)}
              </Badge>
            </div>

            {/* Due date */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
              <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Vencimiento
                </p>
                <p className="text-sm font-semibold capitalize">
                  {format(new Date(payment.due_date), "EEEE d 'de' MMMM yyyy", {
                    locale: es,
                  })}
                </p>
              </div>
            </div>

            {payment.method && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Método
                  </p>
                  <p className="text-sm font-semibold">{payment.method}</p>
                </div>
              </div>
            )}

            {payment.notes && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border/50">
                <StickyNote className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Notas
                  </p>
                  <p className="text-sm italic">{payment.notes}</p>
                </div>
              </div>
            )}

            {payment.paid_at && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                  ✓ Pagado el{" "}
                  {format(new Date(payment.paid_at), "d 'de' MMMM yyyy", {
                    locale: es,
                  })}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t space-y-2 bg-card">
            {status !== "paid" && payment.status !== "cancelled" && (
              <Button
                onClick={handleMarkPaid}
                disabled={actionLoading}
                className="w-full h-12 rounded-xl text-base font-semibold bg-emerald-500 hover:bg-emerald-600"
              >
                <Check className="w-4 h-4 mr-2" />
                Marcar como pagado
              </Button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEdit(true)}
                disabled={actionLoading}
                className="h-11 rounded-xl"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDelete(true)}
                disabled={actionLoading}
                className="h-11 rounded-xl text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <PaymentWhatsAppMenu
                patientPhone={payment.patient_phone}
                patientName={payment.patient_name}
                businessId={businessId}
                amount={payment.amount}
                currency={payment.currency}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPatient}
                className="rounded-lg gap-2"
              >
                Ver paciente
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Edit modal */}
      <PaymentForm
        open={showEdit}
        onOpenChange={setShowEdit}
        patientId={payment.patient_id}
        businessId={businessId}
        paymentId={payment.id}
        initialData={{
          amount: payment.amount,
          due_date: payment.due_date,
          method: payment.method,
          notes: payment.notes,
        }}
        onSuccess={() => {
          setShowEdit(false);
          onUpdated();
          onClose();
        }}
      />

      {/* Delete confirmation */}
      <AlertDialog open={showDelete} onOpenChange={(o) => !actionLoading && setShowDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El pago será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={actionLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={actionLoading}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

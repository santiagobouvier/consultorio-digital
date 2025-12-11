import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, Edit, MoreVertical } from "lucide-react";
import { PaymentForm } from "@/components/PaymentForm";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  calculatePaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusLabel,
  formatCurrency,
  PAYMENT_METHODS,
  type Payment,
  type PaymentStatus,
} from "@/lib/payments";

interface PatientPaymentsProps {
  patientId: string;
  businessId: string;
}

export function PatientPayments({ patientId, businessId }: PatientPaymentsProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  useEffect(() => {
    fetchPayments();
  }, [patientId]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("patient_id", patientId)
        .eq("business_id", businessId)
        .order("due_date", { ascending: false });

      if (error) throw error;

      // Calculate real-time status for each payment
      const paymentsWithStatus = (data || []).map((payment) => ({
        ...payment,
        status: calculatePaymentStatus(payment),
      })) as Payment[];
      setPayments(paymentsWithStatus);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pagos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (paymentId: string) => {
    try {
      const { error } = await supabase
        .from("payments")
        .update({ paid_at: new Date().toISOString(), status: "paid" })
        .eq("id", paymentId);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago marcado como pagado",
      });
      fetchPayments();
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el pago",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setShowForm(true);
  };

  const getMethodLabel = (method: string | null) => {
    if (!method) return null;
    const found = PAYMENT_METHODS.find((m) => m.value === method);
    return found?.label || method;
  };

  if (loading) {
    return (
      <Card className="mobile-card">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">Cargando pagos...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mobile-card">
        <CardHeader className="pb-3 px-0 pt-0 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-bold">Pagos y vencimientos</CardTitle>
            <Button
              onClick={() => {
                setEditingPayment(null);
                setShowForm(true);
              }}
              className="rounded-xl h-10 px-4 font-semibold"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Registrar pago</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 sm:px-6 sm:pb-6">
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              No hay pagos registrados
            </p>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="mobile-card-compact flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">
                        {formatCurrency(payment.amount, payment.currency)}
                      </span>
                      <Badge className={`${getPaymentStatusColor(payment.status)} rounded-full text-xs`}>
                        {getPaymentStatusLabel(payment.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Vence: {format(new Date(payment.due_date), "d MMM yyyy", { locale: es })}
                    </p>
                    {payment.method && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getMethodLabel(payment.method)}
                      </p>
                    )}
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        {payment.notes}
                      </p>
                    )}
                    {payment.paid_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Pagado el {format(new Date(payment.paid_at), "d MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                  
                  {payment.status !== "paid" && payment.status !== "cancelled" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleMarkAsPaid(payment.id)}>
                          <Check className="h-4 w-4 mr-2" />
                          Marcar como pagado
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(payment)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingPayment(null);
        }}
        patientId={patientId}
        businessId={businessId}
        paymentId={editingPayment?.id}
        initialData={
          editingPayment
            ? {
                amount: editingPayment.amount,
                due_date: editingPayment.due_date,
                method: editingPayment.method,
                notes: editingPayment.notes,
              }
            : undefined
        }
        onSuccess={fetchPayments}
      />
    </>
  );
}

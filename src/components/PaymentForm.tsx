import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, RECURRENCE_TYPES, type RecurrenceType } from "@/lib/payments";
import { notifyPatient } from "@/lib/push-notifications";
import { invalidatePaymentData } from "@/lib/data-sync";
import { Switch } from "@/components/ui/switch";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const paymentSchema = z.object({
  amount: z.coerce.number().min(1, "El monto debe ser mayor a 0"),
  due_date: z.date({ required_error: "La fecha de vencimiento es requerida" }),
  method: z.string().optional(),
  notes: z.string().optional(),
  recurrence_type: z.enum(["one_time", "monthly", "yearly"]).default("one_time"),
  anchor_day: z.coerce.number().min(1).max(31).optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  businessId: string;
  paymentId?: string;
  initialData?: {
    amount: number;
    due_date: string;
    method: string | null;
    notes: string | null;
    recurrence_type?: RecurrenceType;
    anchor_day?: number | null;
  };
  onSuccess: () => void;
}

export function PaymentForm({
  open,
  onOpenChange,
  patientId,
  businessId,
  paymentId,
  initialData,
  onSuccess,
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  // "Ya lo cobraste": registra el pago directo como pagado (solo alta, pago único)
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  useEffect(() => {
    if (open) setAlreadyPaid(false);
  }, [open]);
  const queryClient = useQueryClient();
  const isEditing = !!paymentId;

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: initialData?.amount || 0,
      due_date: initialData?.due_date ? new Date(initialData.due_date) : undefined,
      method: initialData?.method || "",
      notes: initialData?.notes || "",
      recurrence_type: initialData?.recurrence_type || "one_time",
      anchor_day: initialData?.anchor_day || undefined,
    },
  });

  const recurrenceType = form.watch("recurrence_type");
  const dueDate = form.watch("due_date");

  // Auto-set anchor_day when due_date changes and recurrence is not one_time
  const handleDueDateChange = (date: Date | undefined) => {
    form.setValue("due_date", date as Date);
    if (date && recurrenceType !== "one_time") {
      form.setValue("anchor_day", date.getDate());
    }
  };

  const onSubmit = async (data: PaymentFormData) => {
    try {
      setLoading(true);

      const anchorDay = data.recurrence_type !== "one_time"
        ? (data.anchor_day || data.due_date.getDate())
        : null;

      const markPaid = alreadyPaid && data.recurrence_type === "one_time";

      const paymentData = {
        business_id: businessId,
        patient_id: patientId,
        amount: data.amount,
        due_date: data.due_date.toISOString(),
        method: data.method || null,
        notes: data.notes || null,
        recurrence_type: data.recurrence_type,
        anchor_day: anchorDay,
      };

      if (isEditing) {
        // Al editar NO se toca el estado ni la fecha de pago: eso se maneja
        // con Cobrar / el link de pago, no desde la edición de datos.
        const { error } = await supabase
          .from("payments")
          .update(paymentData)
          .eq("id", paymentId);

        if (error) throw error;

        toast({
          title: "Éxito",
          description: "Pago actualizado correctamente",
        });
      } else {
        const { error } = await supabase
          .from("payments")
          .insert({
            ...paymentData,
            status: markPaid ? ("paid" as const) : ("pending" as const),
            paid_at: markPaid ? new Date().toISOString() : null,
          });

        if (error) throw error;

        // Notify patient about new payment
        notifyPatient({
          patientId,
          title: markPaid ? "Pago registrado ✓" : "Nuevo pago registrado",
          body: markPaid
            ? `Se registró tu pago de $${data.amount}. ¡Gracias!`
            : `Se registró un pago de $${data.amount}.`,
          url: "/portal",
        });

        toast({
          title: markPaid ? "Pago cobrado ✓" : "Éxito",
          description: markPaid
            ? "Quedó registrado como pagado."
            : "Pago registrado correctamente",
        });
      }

      onSuccess();
      // Refresca TODAS las cachés que muestran plata (Pagos, agenda, ficha)
      invalidatePaymentData(queryClient);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error saving payment:", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el pago",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar pago" : "Registrar pago"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto (UYU)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      className="rounded-xl"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de vencimiento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full pl-3 text-left font-normal rounded-xl",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP", { locale: es })
                          ) : (
                            <span>Seleccionar fecha</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={handleDueDateChange}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="recurrence_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de pago</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RECURRENCE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {recurrenceType !== "one_time" && (
              <FormField
                control={form.control}
                name="anchor_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Día de vencimiento mensual</FormLabel>
                    <Select 
                      onValueChange={(val) => field.onChange(parseInt(val))} 
                      value={field.value?.toString() || dueDate?.getDate()?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Seleccionar día" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                          <SelectItem key={day} value={day.toString()}>
                            Día {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Método de pago (opcional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Seleccionar método" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Este campo es solo un registro de cómo te pagan; no genera ningún cobro.
                    Si querés cobrar online con un link de pago, eso funciona únicamente con
                    tu cuenta de <strong>Mercado Pago conectada</strong>: registrá el pago y
                    después tocá el botón 💬 → "Enviar link de pago".
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Registrar un cobro que YA ocurrió (solo alta, pago único) */}
            {!isEditing && recurrenceType === "one_time" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">¿Ya lo cobraste?</p>
                  <p className="text-xs text-muted-foreground">
                    Queda registrado directo como <strong>pagado</strong> — para llevar el registro, sin nada pendiente.
                  </p>
                </div>
                <Switch checked={alreadyPaid} onCheckedChange={setAlreadyPaid} className="shrink-0" />
              </div>
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nota (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Agregar una nota..."
                      className="rounded-xl resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl"
                disabled={loading}
              >
                {loading ? "Guardando..." : isEditing ? "Guardar" : "Registrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

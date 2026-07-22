import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PAYMENT_METHODS, RECURRENCE_TYPES } from "@/lib/payments";

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

const globalPaymentSchema = z.object({
  patient_id: z.string().min(1, "Debe seleccionar un paciente"),
  amount: z.coerce.number().min(1, "El monto debe ser mayor a 0"),
  due_date: z.date({ required_error: "La fecha de vencimiento es requerida" }),
  method: z.string().optional(),
  notes: z.string().optional(),
  recurrence_type: z.enum(["one_time", "monthly", "yearly"]).default("one_time"),
  anchor_day: z.coerce.number().min(1).max(31).optional(),
});

type GlobalPaymentFormData = z.infer<typeof globalPaymentSchema>;

interface Patient {
  id: string;
  full_name: string;
}

interface GlobalPaymentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onSuccess: () => void;
}

export function GlobalPaymentForm({
  open,
  onOpenChange,
  businessId,
  onSuccess,
}: GlobalPaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const form = useForm<GlobalPaymentFormData>({
    resolver: zodResolver(globalPaymentSchema),
    defaultValues: {
      patient_id: "",
      amount: 0,
      due_date: undefined,
      method: "",
      notes: "",
      recurrence_type: "one_time",
      anchor_day: undefined,
    },
  });

  const recurrenceType = form.watch("recurrence_type");
  const dueDate = form.watch("due_date");

  useEffect(() => {
    if (open && businessId) {
      fetchPatients();
    }
  }, [open, businessId]);

  const fetchPatients = async () => {
    try {
      setLoadingPatients(true);
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("full_name", { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleDueDateChange = (date: Date | undefined) => {
    form.setValue("due_date", date as Date);
    if (date && recurrenceType !== "one_time") {
      form.setValue("anchor_day", date.getDate());
    }
  };

  const onSubmit = async (data: GlobalPaymentFormData) => {
    try {
      setLoading(true);

      const anchorDay = data.recurrence_type !== "one_time" 
        ? (data.anchor_day || data.due_date.getDate())
        : null;

      const paymentData = {
        business_id: businessId,
        patient_id: data.patient_id,
        amount: data.amount,
        due_date: data.due_date.toISOString(),
        method: data.method || null,
        notes: data.notes || null,
        status: "pending" as const,
        recurrence_type: data.recurrence_type,
        anchor_day: anchorDay,
      };

      const { error } = await supabase.from("payments").insert(paymentData);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Pago registrado correctamente",
      });

      onSuccess();
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

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      form.reset();
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="patient_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paciente</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue
                          placeholder={
                            loadingPatients
                              ? "Cargando..."
                              : "Seleccionar paciente"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                onClick={() => handleClose(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1 rounded-xl"
                disabled={loading}
              >
                {loading ? "Guardando..." : "Registrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

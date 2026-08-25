import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { CreditCard, User, Loader2, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  full_name: string;
}

interface QuickPaymentDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  businessId: string;
  onSuccess: () => void;
  lockDate?: boolean;
}

export const QuickPaymentDrawer = ({
  open,
  onClose,
  selectedDate,
  businessId,
  onSuccess,
  lockDate = false,
}: QuickPaymentDrawerProps) => {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Form state
  const [paymentDate, setPaymentDate] = useState<Date>(selectedDate);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("pending");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && businessId) {
      fetchPatients();
    }
  }, [open, businessId]);

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      setPaymentDate(selectedDate);
      setSelectedPatientId("");
      setAmount("");
      setPaymentStatus("pending");
      setNotes("");
    }
  }, [open, selectedDate]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los pacientes",
        variant: "destructive",
      });
    } finally {
      setLoadingPatients(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPatientId) {
      toast({
        title: "Error",
        description: "Seleccioná un paciente",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Ingresá un monto válido",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        business_id: businessId,
        patient_id: selectedPatientId,
        amount: parseFloat(amount),
        currency: "UYU",
        due_date: paymentDate.toISOString(),
        status: paymentStatus,
        paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
        recurrence_type: "one_time" as const,
        notes: notes.trim() || null,
      };

      const { error } = await supabase.from("payments").insert(paymentData);

      if (error) throw error;

      toast({
        title: paymentStatus === "paid" ? "Pago registrado" : "Cobro pendiente creado",
        description: `$${parseFloat(amount).toLocaleString()} - ${format(paymentDate, "d 'de' MMMM", { locale: es })}`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating payment:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el pago",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formBody = (
    <>
        <div className="overflow-y-auto p-4 space-y-5">
          {/* Patient selector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Paciente *
            </Label>
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue placeholder="Seleccionar paciente" />
              </SelectTrigger>
              <SelectContent>
                {loadingPatients ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : patients.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    No hay pacientes registrados
                  </div>
                ) : (
                  patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Monto *</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-12 rounded-xl text-base pl-8 text-lg font-semibold"
                min="0"
              />
            </div>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Fecha
            </Label>
            {lockDate ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled
                  className="w-full h-12 rounded-xl text-base justify-start font-normal disabled:opacity-100 disabled:cursor-not-allowed"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(paymentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Fecha fijada desde la agenda. Para elegir otra, usá "+ Nuevo" en el encabezado.
                </p>
              </>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl text-base justify-start font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(paymentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => date && setPaymentDate(date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Payment status toggle */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Estado</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={paymentStatus === "pending" ? "default" : "outline"}
                className={cn(
                  "h-12 rounded-xl text-base font-medium",
                  paymentStatus === "pending" && "bg-amber-500 hover:bg-amber-600"
                )}
                onClick={() => setPaymentStatus("pending")}
              >
                Por cobrar
              </Button>
              <Button
                type="button"
                variant={paymentStatus === "paid" ? "default" : "outline"}
                className={cn(
                  "h-12 rounded-xl text-base font-medium",
                  paymentStatus === "paid" && "bg-emerald-500 hover:bg-emerald-600"
                )}
                onClick={() => setPaymentStatus("paid")}
              >
                Pagado
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Nota (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Concepto del pago..."
              rows={2}
              className="rounded-xl text-base resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedPatientId || !amount}
            className={cn(
              "w-full h-12 rounded-xl text-base font-semibold",
              paymentStatus === "paid" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : paymentStatus === "paid" ? (
              "Registrar pago"
            ) : (
              "Crear cobro pendiente"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            className="w-full h-12 rounded-xl text-base"
          >
            Cancelar
          </Button>
        </div>
    </>
  );

  const header = (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
        <CreditCard className="w-5 h-5 text-emerald-600" />
      </div>
      <span className="text-lg font-bold">Registrar pago</span>
    </div>
  );

  // Celular: bottom-sheet. Escritorio: diálogo centrado y angosto
  // (el drawer a pantalla completa quedaba desproporcionado).
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DrawerContent className="max-h-[94dvh]">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="text-left">{header}</DrawerTitle>
          </DrawerHeader>
          {formBody}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[88dvh] overflow-y-auto p-0 gap-0">
        <DialogTitle asChild>
          <div className="border-b p-4">{header}</div>
        </DialogTitle>
        {formBody}
      </DialogContent>
    </Dialog>
  );
};

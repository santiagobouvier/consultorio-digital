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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { Calendar, Clock, User, CreditCard, Loader2, CalendarIcon, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfessionals } from "@/hooks/use-professionals";

interface Patient {
  id: string;
  full_name: string;
}

interface QuickAppointmentDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedDate: Date;
  businessId: string;
  onSuccess: () => void;
}

export const QuickAppointmentDrawer = ({
  open,
  onClose,
  selectedDate,
  businessId,
  onSuccess,
}: QuickAppointmentDrawerProps) => {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const { professionals, currentUserId } = useProfessionals(businessId);

  // Form state
  const [appointmentDate, setAppointmentDate] = useState<Date>(selectedDate);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [notes, setNotes] = useState("");

  // Payment state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending">("pending");
  const [defaultPrice, setDefaultPrice] = useState<number | null>(null);

  useEffect(() => {
    if (open && businessId) {
      fetchPatients();
    }
  }, [open, businessId]);

  // Precargar tarifa default del consultorio
  useEffect(() => {
    if (!open || !businessId) return;
    (async () => {
      const { data } = await supabase
        .from("businesses")
        .select("default_session_price")
        .eq("id", businessId)
        .maybeSingle();
      const v = (data as any)?.default_session_price;
      if (v != null) {
        setDefaultPrice(Number(v));
        setPaymentAmount(String(v));
      } else {
        setDefaultPrice(null);
      }
    })();
  }, [open, businessId]);

  // Cada profesional crea SOLO sus propias citas.
  useEffect(() => {
    if (currentUserId) setSelectedProfessionalId(currentUserId);
  }, [currentUserId]);

  // Reset form when drawer opens with new date
  useEffect(() => {
    if (open) {
      setAppointmentDate(selectedDate);
      setSelectedPatientId("");
      setTime("09:00");
      setDuration("60");
      setNotes("");
      setPaymentAmount("");
      setPaymentStatus("pending");
      // Reset professional to current user
      const currentProfessional = professionals.find(p => p.userId === currentUserId);
      if (currentProfessional) {
        setSelectedProfessionalId(currentProfessional.userId);
      }
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

    if (!time) {
      toast({
        title: "Error",
        description: "Ingresá una hora",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Build start_at and end_at
      const dateStr = format(appointmentDate, "yyyy-MM-dd");
      const startAt = new Date(`${dateStr}T${time}:00`);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + parseInt(duration));

      // Determine payment_status based on payment form
      const appointmentPaymentStatus = paymentAmount && parseFloat(paymentAmount) > 0
        ? (paymentStatus === "paid" ? "pagado" : "pendiente")
        : "pendiente";

      // Insert appointment
      const { data: appointment, error: aptError } = await supabase
        .from("appointments")
        .insert({
          business_id: businessId,
          patient_id: selectedPatientId,
          professional_id: selectedProfessionalId || currentUserId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          status: "pending",
          source: "panel",
          payment_status: appointmentPaymentStatus,
          notes: notes.trim() || null,
          session_price: paymentAmount ? parseFloat(paymentAmount) : null,
        } as any)
        .select()
        .single();

      if (aptError) throw aptError;

      // El trigger auto-crea un pago pendiente. Si el usuario marcó "Pagado", actualizamos el pago.
      if (paymentAmount && parseFloat(paymentAmount) > 0 && paymentStatus === "paid") {
        const { error: payErr } = await supabase
          .from("payments")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("appointment_id", appointment.id);
        if (payErr) {
          console.error("Error marking payment paid:", payErr);
        }
      }

      toast({
        title: "Cita creada",
        description: `Cita para las ${time} del ${format(appointmentDate, "d 'de' MMMM", { locale: es })}`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast({
        title: "Error",
        description: "No se pudo crear la cita",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DrawerTitle className="text-left">Nueva cita</DrawerTitle>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto p-4 space-y-5">
          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Fecha *
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl text-base justify-start font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(appointmentDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={appointmentDate}
                  onSelect={(date) => date && setAppointmentDate(date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          </div>
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

          {/* Cada profesional crea solo sus propias citas (sin selector) */}

          {/* Time */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Hora *
            </Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="h-12 rounded-xl text-base"
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Duración</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-12 rounded-xl text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutos</SelectItem>
                <SelectItem value="45">45 minutos</SelectItem>
                <SelectItem value="60">60 minutos</SelectItem>
                <SelectItem value="90">90 minutos</SelectItem>
                <SelectItem value="120">2 horas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas sobre la cita..."
              rows={2}
              className="rounded-xl text-base resize-none"
            />
          </div>

          {/* Payment Section */}
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Pago (opcional)
            </Label>
            
            <div className="space-y-3">
              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Monto</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                    className="h-12 rounded-xl text-base pl-8"
                    min="0"
                  />
                </div>
              </div>

              {/* Payment status toggle */}
              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Estado del pago</Label>
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
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t space-y-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedPatientId}
            className="w-full h-12 rounded-xl text-base font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear cita"
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
      </DrawerContent>
    </Drawer>
  );
};

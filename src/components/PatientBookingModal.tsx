import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/hooks/use-toast";
import { format, isSameDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock, Video, MapPin, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  modality: string;
  price: number | null;
  start_at: string;
  end_at: string;
  space_id: string;
  professional_id: string;
}

interface PatientBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  patientId: string;
  onSuccess?: () => void;
  /** When provided, the modal opens in "reschedule" mode and creates a reschedule request instead of a new appointment. */
  rescheduleAppointment?: {
    id: string;
    start_at: string;
    end_at: string;
  } | null;
}

type Step = "date" | "slot" | "confirm";

export const PatientBookingModal = ({
  open,
  onOpenChange,
  businessId,
  patientId,
  onSuccess,
  rescheduleAppointment,
}: PatientBookingModalProps) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isReschedule = !!rescheduleAppointment;

  useEffect(() => {
    if (open) {
      loadAvailableSlots();
      resetState();
    }
  }, [open, businessId, rescheduleAppointment?.id]);

  const resetState = () => {
    setStep("date");
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setNotes("");
  };

  const loadAvailableSlots = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const maxDate = addDays(new Date(), 90).toISOString().slice(0, 10);

      // Resolve professional_id: assigned_professional_id (si existe) → owner del business
      let professionalId: string | null = null;
      const { data: patientRow } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();
      const assigned = (patientRow as any)?.assigned_professional_id as string | undefined;
      if (assigned) professionalId = assigned;

      if (!professionalId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("owner_user_id")
          .eq("id", businessId)
          .maybeSingle();
        professionalId = biz?.owner_user_id ?? null;
      }

      if (!professionalId) {
        setSlots([]);
        return;
      }

      // Spaces del business → mapa id → type (para derivar modality)
      const { data: spacesData, error: spacesError } = await supabase
        .from("spaces")
        .select("id, type")
        .eq("business_id", businessId)
        .eq("is_active", true);
      if (spacesError) throw spacesError;
      const spaceTypeById = new Map<string, string>(
        (spacesData || []).map((s: any) => [s.id as string, s.type as string]),
      );

      const { data, error } = await supabase.rpc("get_available_slots", {
        p_business_id: businessId,
        p_professional_id: professionalId,
        p_date_from: today,
        p_date_to: maxDate,
      });
      if (error) throw error;

      const mapped: AvailabilitySlot[] = (data || []).map((row: any) => {
        const start = new Date(row.slot_start_at);
        const end = new Date(row.slot_end_at);
        const spaceId: string = (row.available_space_ids?.[0]) ?? "";
        const spaceType = spaceTypeById.get(spaceId) ?? "physical";
        const modality = spaceType === "virtual" ? "online" : "presencial";
        const pad = (n: number) => String(n).padStart(2, "0");
        return {
          id: `${row.slot_start_at}-${row.professional_id}`,
          date: row.slot_date,
          start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}:00`,
          end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
          modality,
          price: null,
          start_at: row.slot_start_at,
          end_at: row.slot_end_at,
          space_id: spaceId,
          professional_id: row.professional_id,
        };
      });
      setSlots(mapped);
    } catch (error) {
      console.error("Error loading slots:", error);
      toast({ title: "Error", description: "No se pudieron cargar los horarios disponibles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Dates that have available slots
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    slots.forEach((s) => dates.add(s.date));
    return dates;
  }, [slots]);

  // Slots for the selected date
  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return slots.filter((s) => s.date === dateStr);
  }, [slots, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep("slot");
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setStep("confirm");
  };

  const handleBookAppointment = async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      const startAt = selectedSlot.start_at;
      const endAt = selectedSlot.end_at;

      if (isReschedule && rescheduleAppointment) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: reqError } = await supabase
          .from("appointment_reschedule_requests")
          .insert({
            business_id: businessId,
            original_appointment_id: rescheduleAppointment.id,
            requested_slot_id: null,
            requested_start_at: startAt,
            requested_end_at: endAt,
            reason: notes || null,
            requested_by: user?.id || null,
          });
        if (reqError) throw reqError;

        const { error: updError } = await supabase
          .from("appointments")
          .update({ status: "reschedule_requested" })
          .eq("id", rescheduleAppointment.id);
        if (updError) throw updError;

        toast({
          title: "Solicitud enviada",
          description: "Tu profesional la confirmará pronto.",
        });
      } else {
        const { error: appointmentError } = await supabase
          .from("appointments")
          .insert({
            business_id: businessId,
            patient_id: patientId,
            availability_slot_id: null,
            space_id: selectedSlot.space_id,
            professional_id: selectedSlot.professional_id,
            start_at: startAt,
            end_at: endAt,
            modality: selectedSlot.modality,
            notes: notes || null,
            status: "pending",
            source: "patient_portal",
          });

        if (appointmentError) throw appointmentError;

        toast({
          title: "✅ Cita solicitada",
          description: "Tu cita fue solicitada. El profesional la confirmará pronto.",
        });
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error booking appointment:", error);
      toast({ title: "Error", description: error.message || "No se pudo procesar la solicitud", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const isDateAvailable = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return availableDates.has(dateStr);
  };

  const getModalityBadge = (modality: string) => {
    const isOnline = modality === "online" || modality === "virtual";
    return (
      <span className={cn(
        "inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
        isOnline ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      )}>
        {isOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
        {isOnline ? "Online" : "Presencial"}
      </span>
    );
  };

  const stepTitle: Record<Step, string> = {
    date: isReschedule ? "Elegí una nueva fecha" : "Elegí una fecha",
    slot: isReschedule ? "Elegí un nuevo horario" : "Elegí un horario",
    confirm: isReschedule ? "Confirmá la reprogramación" : "Confirmá tu reserva",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 w-[calc(100%-1rem)] sm:w-full">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {step !== "date" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 -ml-1"
                onClick={() => {
                  if (step === "confirm") setStep("slot");
                  else if (step === "slot") { setStep("date"); setSelectedDate(undefined); }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {isReschedule ? "Reprogramar cita" : "Reservar una cita"}
          </DialogTitle>
          <DialogDescription>{stepTitle[step]}</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          {isReschedule && rescheduleAppointment && (
            <div className="mb-4 p-3 rounded-xl bg-muted/60 border border-border text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                Cita actual
              </p>
              <p className="font-medium capitalize">
                {format(new Date(rescheduleAppointment.start_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })} hs
              </p>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-10">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-medium mb-1">No hay turnos disponibles por el momento.</p>
              <p className="text-sm text-muted-foreground">Contactá a tu profesional.</p>
            </div>
          ) : step === "date" ? (
            <DateStep
              availableDates={availableDates}
              isDateAvailable={isDateAvailable}
              onSelect={handleDateSelect}
              selectedDate={selectedDate}
            />
          ) : step === "slot" ? (
            <SlotStep
              slots={slotsForDate}
              selectedDate={selectedDate!}
              getModalityBadge={getModalityBadge}
              onSelect={handleSlotSelect}
            />
          ) : (
            <ConfirmStep
              slot={selectedSlot!}
              selectedDate={selectedDate!}
              getModalityBadge={getModalityBadge}
              notes={notes}
              onNotesChange={setNotes}
              onConfirm={handleBookAppointment}
              submitting={submitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/* ─── Sub-components ─── */

function DateStep({
  availableDates,
  isDateAvailable,
  onSelect,
  selectedDate,
}: {
  availableDates: Set<string>;
  isDateAvailable: (d: Date) => boolean;
  onSelect: (d: Date | undefined) => void;
  selectedDate: Date | undefined;
}) {
  const today = new Date();

  return (
    <div className="flex justify-center">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        locale={es}
        disabled={(date) => date < today || !isDateAvailable(date)}
        fromDate={today}
        toDate={addDays(today, 90)}
        className="p-3 pointer-events-auto"
        modifiers={{ available: (date) => isDateAvailable(date) }}
        modifiersClassNames={{ available: "font-bold text-primary" }}
      />
    </div>
  );
}

function SlotStep({
  slots,
  selectedDate,
  getModalityBadge,
  onSelect,
}: {
  slots: AvailabilitySlot[];
  selectedDate: Date;
  getModalityBadge: (m: string) => JSX.Element;
  onSelect: (s: AvailabilitySlot) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
      </p>
      <div className="grid gap-2 max-h-64 overflow-y-auto">
        {slots.map((slot) => (
          <button
            key={slot.id}
            onClick={() => onSelect(slot)}
            className="flex items-center justify-between w-full p-3 border rounded-xl hover:border-primary hover:bg-accent/50 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
              </div>
              {getModalityBadge(slot.modality)}
            </div>
            <div className="flex items-center gap-2">
              {slot.price != null && slot.price > 0 && (
                <span className="text-xs text-muted-foreground">${slot.price}</span>
              )}
              <span className="text-xs text-primary font-medium">Elegir →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfirmStep({
  slot,
  selectedDate,
  getModalityBadge,
  notes,
  onNotesChange,
  onConfirm,
  submitting,
}: {
  slot: AvailabilitySlot;
  selectedDate: Date;
  getModalityBadge: (m: string) => JSX.Element;
  notes: string;
  onNotesChange: (v: string) => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="p-4 bg-muted/50 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium capitalize">
            {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
        </div>
        <div className="flex items-center gap-2">
          {getModalityBadge(slot.modality)}
          {slot.price != null && slot.price > 0 && (
            <span className="text-sm text-muted-foreground">${slot.price}</span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="booking-notes">Notas adicionales (opcional)</Label>
        <Textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="¿Hay algo que quieras comentar antes de la cita?"
          rows={3}
        />
      </div>

      <Button onClick={onConfirm} disabled={submitting} className="w-full" size="lg">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Reservando...
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar reserva
          </>
        )}
      </Button>
    </div>
  );
}

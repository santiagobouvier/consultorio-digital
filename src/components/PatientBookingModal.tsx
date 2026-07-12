import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  MapPin,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightSmall,
  X,
  Info,
  Check,
  CalendarX2,
} from "lucide-react";
import { DayPicker } from "react-day-picker";
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

interface BookingBranding {
  name?: string;
  logoUrl?: string;
  cancellationHoursNotice?: number;
}

interface PatientBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  patientId: string;
  onSuccess?: () => void;
  branding?: BookingBranding;
  rescheduleAppointment?: {
    id: string;
    start_at: string;
    end_at: string;
  } | null;
}

type Step = "date" | "slot" | "confirm" | "success";

export const PatientBookingModal = ({
  open,
  onOpenChange,
  businessId,
  patientId,
  onSuccess,
  branding,
  rescheduleAppointment,
}: PatientBookingModalProps) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [step, setStep] = useState<Step>("date");
  const [prevStep, setPrevStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const isReschedule = !!rescheduleAppointment;
  const cancellationHours = branding?.cancellationHoursNotice ?? 24;

  useEffect(() => {
    if (open) {
      loadAvailableSlots();
      resetState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId, rescheduleAppointment?.id]);

  const resetState = () => {
    setStep("date");
    setPrevStep("date");
    setSelectedDate(undefined);
    setSelectedSlot(null);
    setNotes("");
    setCalendarMonth(new Date());
  };

  const goToStep = (next: Step) => {
    setPrevStep(step);
    setStep(next);
  };

  const loadAvailableSlots = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const maxDate = addDays(new Date(), 90).toISOString().slice(0, 10);

      let fallbackProfessionalId: string | null = null;
      const { data: patientRow } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();
      const assigned = (patientRow as any)?.assigned_professional_id as string | undefined;
      if (assigned) fallbackProfessionalId = assigned;

      if (!fallbackProfessionalId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("owner_user_id")
          .eq("id", businessId)
          .maybeSingle();
        fallbackProfessionalId = biz?.owner_user_id ?? null;
      }

      // Lee directo de availability_slots (RLS deja ver los available del business
      // al paciente autenticado). Esta es la misma fuente que usa "Horarios del
      // consultorio", así que lo que el profesional configura aparece acá.
      const { data, error } = await (supabase as any)
        .from("availability_slots")
        .select("id, date, start_time, end_time, modality, price, professional_user_id")
        .eq("business_id", businessId)
        .eq("status", "available")
        .gte("date", today)
        .lte("date", maxDate)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;

      const mapped: AvailabilitySlot[] = (data || []).map((row: any) => {
        const startAt = new Date(`${row.date}T${row.start_time}`).toISOString();
        const endAt = new Date(`${row.date}T${row.end_time}`).toISOString();
        const rawMod = String(row.modality || "").toLowerCase();
        const modality = rawMod.includes("online") || rawMod.includes("virtual") ? "online" : "presencial";
        return {
          id: row.id,
          date: row.date,
          start_time: row.start_time,
          end_time: row.end_time,
          modality,
          price: row.price ?? null,
          start_at: startAt,
          end_at: endAt,
          space_id: "",
          professional_id: row.professional_user_id ?? fallbackProfessionalId ?? "",
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

  const slotsByDate = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>();
    slots.forEach((s) => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });
    return map;
  }, [slots]);

  const availableDates = useMemo(() => new Set(slotsByDate.keys()), [slotsByDate]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    return (slotsByDate.get(dateStr) || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slotsByDate, selectedDate]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setSelectedSlot(null);
    goToStep("slot");
  };

  const handleSlotSelect = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    goToStep("confirm");
  };

  const handleBack = () => {
    if (step === "confirm") goToStep("slot");
    else if (step === "slot") {
      setSelectedDate(undefined);
      goToStep("date");
    }
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
            requested_slot_id: selectedSlot.id || null,
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
      } else {
        const { error: appointmentError } = await supabase
          .from("appointments")
          .insert({
            business_id: businessId,
            patient_id: patientId,
            availability_slot_id: selectedSlot.id || null,
            space_id: selectedSlot.space_id || null,
            professional_id: selectedSlot.professional_id,
            start_at: startAt,
            end_at: endAt,
            modality: selectedSlot.modality,
            notes: notes || null,
            status: "pending",
            source: "patient_portal",
          });
        if (appointmentError) throw appointmentError;

        // Reservar el slot para que no pueda volver a elegirse.
        if (selectedSlot.id) {
          await (supabase as any)
            .from("availability_slots")
            .update({ status: "booked" })
            .eq("id", selectedSlot.id);
        }
      }

      goToStep("success");
      toast({
        title: isReschedule ? "Solicitud enviada" : "Reserva creada",
        description: isReschedule
          ? "Tu profesional la confirmará pronto."
          : "Tu profesional confirmará pronto.",
      });
      onSuccess?.();
    } catch (error: any) {
      console.error("Error booking appointment:", error);
      toast({ title: "Error", description: error.message || "No se pudo procesar la solicitud", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const getModalityPill = (modality: string, size: "sm" | "md" = "sm") => {
    const isOnline = modality === "online" || modality === "virtual";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium",
          size === "sm" ? "text-xs px-2.5 py-1" : "text-sm px-3 py-1.5",
          isOnline
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        )}
      >
        {isOnline ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
        {isOnline ? "Online" : "Presencial"}
      </span>
    );
  };

  const stepTitle: Record<Step, string> = {
    date: isReschedule ? "Elegí una nueva fecha" : "Elegí una fecha",
    slot: isReschedule ? "Elegí un nuevo horario" : "Elegí un horario",
    confirm: isReschedule ? "Confirmá la reprogramación" : "Confirmá tu reserva",
    success: isReschedule ? "Solicitud enviada" : "Reserva confirmada",
  };

  const stepIndex: Record<Step, number> = { date: 0, slot: 1, confirm: 2, success: 2 };
  const currentIndex = stepIndex[step];

  // Slide direction for transition
  const isForward = stepIndex[step] >= stepIndex[prevStep];
  const slideClass =
    step === "success"
      ? "animate-in fade-in zoom-in-95 duration-300"
      : isForward
        ? "animate-in fade-in slide-in-from-right-4 duration-200"
        : "animate-in fade-in slide-in-from-left-4 duration-200";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          // Mobile full-screen
          "w-screen h-[100dvh] max-w-none rounded-none border-0",
          // Desktop centered
          "sm:w-full sm:h-auto sm:max-w-lg sm:max-h-[90vh] sm:rounded-2xl sm:border",
          "flex flex-col bg-background backdrop-blur-sm",
        )}
      >
        <DialogTitle className="sr-only">
          {isReschedule ? "Reprogramar cita" : "Reservar una cita"}
        </DialogTitle>
        <DialogDescription className="sr-only">{stepTitle[step]}</DialogDescription>

        {/* Sticky header */}
        <header
          className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-2 px-4 sm:px-6 h-14">
            {step !== "date" && step !== "success" ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 sm:h-9 sm:w-9 -ml-2 shrink-0"
                onClick={handleBack}
                aria-label="Volver"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="w-9 shrink-0" />
            )}

            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h2 className="text-base font-bold leading-tight truncate">
                {isReschedule ? "Reprogramar cita" : "Reservar una cita"}
              </h2>
              <p className="text-xs text-muted-foreground truncate">{stepTitle[step]}</p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9 -mr-2 shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Branding strip */}
          {(branding?.name || branding?.logoUrl) && step !== "success" && (
            <div className="flex items-center justify-center gap-2 pb-2 px-4">
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt=""
                  className="h-6 w-6 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {branding.name?.substring(0, 2).toUpperCase()}
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate">
                {isReschedule ? "Reprogramando con" : "Reservando con"}{" "}
                <span className="font-medium text-foreground">{branding.name}</span>
              </p>
            </div>
          )}

          {/* Progress dots */}
          {step !== "success" && (
            <div className="flex items-center justify-center gap-2 pb-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      i === currentIndex
                        ? "w-6 bg-primary"
                        : i < currentIndex
                          ? "w-2 bg-primary/70"
                          : "w-2 bg-muted-foreground/25",
                    )}
                  />
                  {i < 2 && (
                    <div
                      className={cn(
                        "h-px w-3 transition-colors duration-300",
                        i < currentIndex ? "bg-primary/40" : "bg-muted-foreground/20",
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </header>

        {/* Reschedule info */}
        {isReschedule && rescheduleAppointment && step !== "success" && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 rounded-xl bg-muted/60 border text-sm shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
              Cita actual
            </p>
            <p className="font-medium capitalize text-sm">
              {format(new Date(rescheduleAppointment.start_at), "EEEE d 'de' MMMM, HH:mm", { locale: es })} hs
            </p>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div key={step} className={cn("px-4 sm:px-6 py-4", slideClass)}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : step === "success" ? (
              <SuccessStep
                slot={selectedSlot!}
                selectedDate={selectedDate!}
                isReschedule={isReschedule}
                onClose={() => onOpenChange(false)}
              />
            ) : slots.length === 0 ? (
              <EmptyState onClose={() => onOpenChange(false)} />
            ) : step === "date" ? (
              <DateStep
                availableDates={availableDates}
                slotsByDate={slotsByDate}
                onSelect={handleDateSelect}
                selectedDate={selectedDate}
                month={calendarMonth}
                setMonth={setCalendarMonth}
              />
            ) : step === "slot" ? (
              <SlotStep
                slots={slotsForDate}
                selectedDate={selectedDate!}
                getModalityPill={getModalityPill}
                onSelect={handleSlotSelect}
                onBack={handleBack}
              />
            ) : (
              <ConfirmStep
                slot={selectedSlot!}
                selectedDate={selectedDate!}
                getModalityPill={getModalityPill}
                notes={notes}
                onNotesChange={setNotes}
                cancellationHours={cancellationHours}
                isReschedule={isReschedule}
              />
            )}
          </div>
        </div>

        {/* Sticky footer with CTA */}
        {step === "confirm" && (
          <footer
            className="sticky bottom-0 z-20 bg-background/95 backdrop-blur border-t px-4 sm:px-6 py-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <Button
              onClick={handleBookAppointment}
              disabled={submitting}
              className="w-full h-12 text-base"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Reservando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {isReschedule ? "Confirmar reprogramación" : "Confirmar reserva"}
                </>
              )}
            </Button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
};

/* ─── Sub-components ─── */

function DateStep({
  availableDates,
  slotsByDate,
  onSelect,
  selectedDate,
  month,
  setMonth,
}: {
  availableDates: Set<string>;
  slotsByDate: Map<string, AvailabilitySlot[]>;
  onSelect: (d: Date | undefined) => void;
  selectedDate: Date | undefined;
  month: Date;
  setMonth: (d: Date) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = addDays(today, 90);

  const isDateAvailable = (date: Date) => availableDates.has(format(date, "yyyy-MM-dd"));

  return (
    <div className="flex flex-col items-center">
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={onSelect}
        month={month}
        onMonthChange={setMonth}
        locale={es}
        disabled={(date) => date < today || !isDateAvailable(date)}
        fromDate={today}
        toDate={maxDate}
        showOutsideDays
        modifiers={{ available: (date) => isDateAvailable(date) }}
        className="w-full"
        classNames={{
          months: "w-full",
          month: "w-full space-y-3",
          caption: "flex justify-center pt-1 relative items-center mb-2",
          caption_label: "text-base font-bold uppercase tracking-wide",
          nav: "space-x-1 flex items-center",
          nav_button:
            "h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-full hover:bg-accent transition-colors",
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse",
          head_row: "flex w-full",
          head_cell:
            "flex-1 text-muted-foreground/70 font-medium text-[0.7rem] uppercase tracking-wider pb-1",
          row: "flex w-full mt-1",
          cell: "flex-1 text-center text-sm p-0.5 relative",
          day: cn(
            "h-12 w-full md:h-14 inline-flex flex-col items-center justify-center rounded-xl",
            "font-medium transition-all duration-150 relative",
            "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/40",
          ),
          day_selected:
            "!bg-primary !text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-background hover:!bg-primary",
          day_today: "ring-1 ring-primary/40",
          day_outside: "text-muted-foreground/40 opacity-50",
          day_disabled: "text-muted-foreground/30 opacity-40 cursor-not-allowed hover:bg-transparent",
          day_hidden: "invisible",
        }}
        modifiersClassNames={{
          available:
            "bg-primary/10 text-primary font-semibold hover:bg-primary/20 after:content-[''] after:absolute after:bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:h-1 after:w-1 after:rounded-full after:bg-primary",
        }}
        components={{
          IconLeft: () => <ChevronLeft className="h-5 w-5" />,
          IconRight: () => <ChevronRight className="h-5 w-5" />,
        }}
      />

      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Con disponibilidad
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          Sin turnos
        </div>
      </div>
    </div>
  );
}

function SlotStep({
  slots,
  selectedDate,
  getModalityPill,
  onSelect,
  onBack,
}: {
  slots: AvailabilitySlot[];
  selectedDate: Date;
  getModalityPill: (m: string, s?: "sm" | "md") => JSX.Element;
  onSelect: (s: AvailabilitySlot) => void;
  onBack: () => void;
}) {
  if (slots.length === 0) {
    return (
      <div className="text-center py-10">
        <CalendarX2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium mb-1">No hay horarios disponibles este día.</p>
        <p className="text-sm text-muted-foreground mb-4">Probá con otra fecha.</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver al calendario
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold capitalize">
        {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
      </h3>
      <div className="grid gap-2">
        {slots.map((slot, i) => {
          const isOnline = slot.modality === "online" || slot.modality === "virtual";
          return (
            <button
              key={slot.id}
              onClick={() => onSelect(slot)}
              style={{ animationDelay: `${i * 40}ms`, animationFillMode: "both" }}
              className={cn(
                "group flex items-center gap-3 w-full p-4 min-h-16 border-2 rounded-2xl",
                "border-border/60 bg-card hover:border-primary hover:shadow-md hover:-translate-y-0.5",
                "transition-all duration-200 text-left",
                "animate-in fade-in slide-in-from-bottom-2",
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  isOnline
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                )}
              >
                {isOnline ? <Video className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold leading-tight">
                  {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {isOnline ? "Sesión online" : "Sesión presencial"}
                </div>
              </div>
              <ChevronRightSmall className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmStep({
  slot,
  selectedDate,
  getModalityPill,
  notes,
  onNotesChange,
  cancellationHours,
  isReschedule,
}: {
  slot: AvailabilitySlot;
  selectedDate: Date;
  getModalityPill: (m: string, s?: "sm" | "md") => JSX.Element;
  notes: string;
  onNotesChange: (v: string) => void;
  cancellationHours: number;
  isReschedule: boolean;
}) {
  const isOnline = slot.modality === "online" || slot.modality === "virtual";
  const maxNotes = 500;

  return (
    <div className="space-y-4">
      {/* Ticket card */}
      <div className="relative overflow-hidden rounded-2xl bg-muted/30 border">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
        <div className="pl-6 pr-5 py-5 space-y-4">
          <div
            className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center",
              isOnline
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
            )}
          >
            {isOnline ? <Video className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-lg font-bold capitalize leading-tight">
              {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1">
              {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {getModalityPill(slot.modality, "md")}
            {slot.price != null && slot.price > 0 && (
              <span className="inline-flex items-center text-sm font-semibold text-foreground bg-background border rounded-full px-3 py-1">
                ${slot.price}
              </span>
            )}
          </div>
          {isOnline && (
            <p className="text-xs text-muted-foreground">
              Recibirás el link de la videollamada antes del horario.
            </p>
          )}
        </div>
      </div>

      {/* Policy reminder */}
      <div className="flex gap-3 rounded-xl border bg-card/50 p-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Podés cancelar o reprogramar hasta{" "}
          <span className="font-semibold text-foreground">{cancellationHours} horas</span> antes sin
          cargo.
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label htmlFor="booking-notes" className="text-sm font-medium">
          Notas adicionales
        </label>
        <Textarea
          id="booking-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value.slice(0, maxNotes))}
          placeholder={
            isReschedule
              ? "¿Querés contarle algo sobre el cambio de horario? (opcional)"
              : "¿Querés contarle algo a tu profesional antes de la sesión? (opcional)"
          }
          rows={3}
          className="resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right tabular-nums">
          {notes.length}/{maxNotes}
        </p>
      </div>
    </div>
  );
}

function SuccessStep({
  slot,
  selectedDate,
  isReschedule,
  onClose,
}: {
  slot: AvailabilitySlot;
  selectedDate: Date;
  isReschedule: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center text-center py-8 px-2">
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center animate-in zoom-in-50 duration-500">
          <Check className="h-10 w-10" strokeWidth={3} />
        </div>
      </div>
      <h3 className="text-xl font-bold mb-2">
        {isReschedule ? "¡Solicitud enviada!" : "¡Reserva confirmada!"}
      </h3>
      <p className="text-sm text-muted-foreground mb-1 capitalize">
        Te esperamos el {format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
      </p>
      <p className="text-base font-semibold mb-6">
        a las {slot.start_time.slice(0, 5)} hs
      </p>
      <p className="text-xs text-muted-foreground mb-6 max-w-xs">
        {isReschedule
          ? "Tu profesional revisará la solicitud y te confirmará pronto."
          : "Tu profesional confirmará la cita en breve."}
      </p>
      <Button onClick={onClose} className="w-full max-w-xs h-12">
        Volver al portal
      </Button>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center py-12">
      <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
      <p className="font-medium mb-1">No hay turnos disponibles por el momento.</p>
      <p className="text-sm text-muted-foreground mb-4">Contactá a tu profesional.</p>
      <Button variant="outline" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
}

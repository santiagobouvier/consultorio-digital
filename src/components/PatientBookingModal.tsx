import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock, Video, MapPin, Loader2 } from "lucide-react";

interface AvailabilitySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  modality: string;
  price: number | null;
}

interface PatientBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  patientId: string;
  onSuccess?: () => void;
}

export const PatientBookingModal = ({
  open,
  onOpenChange,
  businessId,
  patientId,
  onSuccess,
}: PatientBookingModalProps) => {
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      loadAvailableSlots();
    }
  }, [open, businessId]);

  const loadAvailableSlots = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      
      // Query availability_slots directly - RLS will handle permissions
      const { data, error } = await supabase
        .from("availability_slots")
        .select("id, date, start_time, end_time, modality, price")
        .eq("business_id", businessId)
        .eq("status", "available")
        .gte("date", today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error) {
      console.error("Error loading slots:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los horarios disponibles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedSlot) return;

    setSubmitting(true);
    try {
      // Create the appointment
      const startAt = `${selectedSlot.date}T${selectedSlot.start_time}`;
      const endAt = `${selectedSlot.date}T${selectedSlot.end_time}`;

      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          business_id: businessId,
          patient_id: patientId,
          availability_slot_id: selectedSlot.id,
          start_at: startAt,
          end_at: endAt,
          modality: selectedSlot.modality,
          notes: notes || null,
          status: "pending",
          source: "patient_portal",
        });

      if (appointmentError) throw appointmentError;

      // Update slot status to booked
      const { error: slotError } = await supabase
        .from("availability_slots")
        .update({ status: "booked" })
        .eq("id", selectedSlot.id);

      if (slotError) {
        console.error("Error updating slot status:", slotError);
      }

      toast({
        title: "Cita reservada",
        description: "Tu cita ha sido agendada. El consultorio confirmará la reserva.",
      });

      onOpenChange(false);
      onSuccess?.();
      
      // Reset state
      setSelectedSlot(null);
      setNotes("");
    } catch (error: any) {
      console.error("Error booking appointment:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo reservar la cita",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getModalityIcon = (modality: string) => {
    if (modality === "online" || modality === "virtual") {
      return <Video className="h-4 w-4" />;
    }
    return <MapPin className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservar una cita</DialogTitle>
          <DialogDescription>
            {selectedSlot 
              ? "Confirmá tu reserva" 
              : "Seleccioná un horario disponible"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : selectedSlot ? (
          <div className="space-y-4">
            {/* Selected slot summary */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(new Date(selectedSlot.date), "EEEE d 'de' MMMM", { locale: es })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {selectedSlot.start_time.slice(0, 5)} - {selectedSlot.end_time.slice(0, 5)}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {getModalityIcon(selectedSlot.modality)}
                <span className="capitalize">{selectedSlot.modality}</span>
                {selectedSlot.price && (
                  <span className="ml-2">${selectedSlot.price}</span>
                )}
              </div>
            </div>

            {/* Notes field */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notas adicionales (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="¿Hay algo que quieras comentar antes de la cita?"
                rows={3}
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedSlot(null)}
                className="flex-1"
              >
                Cambiar horario
              </Button>
              <Button
                onClick={handleBookAppointment}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reservando...
                  </>
                ) : (
                  "Confirmar reserva"
                )}
              </Button>
            </div>
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground mb-2">
              Por el momento no hay horarios disponibles.
            </p>
            <p className="text-sm text-muted-foreground">
              Contactá al consultorio para coordinar una cita.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {slots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot)}
                className="w-full p-4 border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(new Date(slot.date), "EEEE d 'de' MMMM", { locale: es })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-muted rounded flex items-center gap-1">
                        {getModalityIcon(slot.modality)}
                        {slot.modality}
                      </span>
                      {slot.price && (
                        <span className="text-xs px-2 py-1 bg-muted rounded">
                          ${slot.price}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-primary">
                    Seleccionar →
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

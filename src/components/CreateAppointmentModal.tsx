import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";

interface Patient {
  id: string;
  full_name: string;
}

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  onSuccess: () => void;
  prefilledDate?: Date | null;
  lockDate?: boolean;
}

export function CreateAppointmentModal({
  open,
  onOpenChange,
  patientId,
  onSuccess,
  prefilledDate,
  lockDate = false,
}: CreateAppointmentModalProps) {
  const navigate = useNavigate();
  const { businessId } = useBusinessId();
  const { professionals, currentUserId, isOwner } = useProfessionals(businessId);

  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientId || "");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [modality, setModality] = useState("presencial");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Prefill date when modal opens with a prefilledDate
  useEffect(() => {
    if (open && prefilledDate) {
      const yyyy = prefilledDate.getFullYear();
      const mm = String(prefilledDate.getMonth() + 1).padStart(2, "0");
      const dd = String(prefilledDate.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [open, prefilledDate]);

  // Set default professional
  useEffect(() => {
    if (!open) return;
    if (!isOwner && currentUserId) {
      setSelectedProfessionalId(currentUserId);
    } else if (professionals.length === 1) {
      setSelectedProfessionalId(professionals[0].userId);
    } else if (!selectedProfessionalId && currentUserId) {
      setSelectedProfessionalId(currentUserId);
    }
  }, [open, professionals, currentUserId, isOwner]);

  useEffect(() => {
    if (open && !patientId) {
      fetchPatients();
    }
    if (patientId) {
      setSelectedPatientId(patientId);
    }
  }, [open, patientId]);

  const fetchPatients = async () => {
    try {
      if (!businessId) return;

      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .order("full_name");

      setPatients(data || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !time) {
      toast({
        title: "Error",
        description: "Por favor completa fecha y hora",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPatientId) {
      toast({
        title: "Error",
        description: "Por favor selecciona un paciente",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      if (!businessId) throw new Error("No se encontró el consultorio");

      const startAt = new Date(`${date}T${time}`);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + parseInt(duration));

      const { error } = await supabase.from("appointments").insert({
        business_id: businessId,
        patient_id: selectedPatientId,
        professional_id: selectedProfessionalId || null,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        modality,
        location: location.trim() || null,
        notes: notes.trim() || null,
        status: "pending",
        payment_status: "pendiente",
      } as any);

      if (error) throw error;

      toast({
        title: "Éxito",
        description: "Cita creada correctamente",
      });

      setDate("");
      setTime("");
      setDuration("60");
      setModality("presencial");
      setLocation("");
      setNotes("");
      setSelectedPatientId(patientId || "");

      onOpenChange(false);
      onSuccess();
      navigate("/agenda");
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

  const showProfessionalSelector = professionals.length > 1;
  const isProfessionalLocked = !isOwner;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-bold">Crear nueva cita</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Paciente */}
            {!patientId && (
              <div className="space-y-2">
                <Label htmlFor="patient" className="text-sm font-semibold">Paciente *</Label>
                <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                  <SelectTrigger id="patient" className="h-12 text-base rounded-xl">
                    <SelectValue placeholder="Selecciona un paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Profesional */}
            {showProfessionalSelector && (
              <div className="space-y-2">
                <Label htmlFor="professional" className="text-sm font-semibold">Profesional</Label>
                <Select
                  value={selectedProfessionalId}
                  onValueChange={setSelectedProfessionalId}
                  disabled={isProfessionalLocked}
                >
                  <SelectTrigger id="professional" className="h-12 text-base rounded-xl">
                    <SelectValue placeholder="Selecciona un profesional" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((prof) => (
                      <SelectItem key={prof.userId} value={prof.userId}>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: prof.color }}
                          />
                          {prof.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isProfessionalLocked && (
                  <p className="text-xs text-muted-foreground">
                    Solo puedes crear citas para tu agenda
                  </p>
                )}
              </div>
            )}

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-semibold">Fecha *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                disabled={lockDate && !!prefilledDate}
                className="h-12 text-base rounded-xl disabled:opacity-100 disabled:cursor-not-allowed"
              />
              {lockDate && !!prefilledDate && (
                <p className="text-xs text-muted-foreground">
                  Fecha fijada desde la agenda. Para elegir otra, usá "+ Nuevo" en el encabezado.
                </p>
              )}
            </div>

            {/* Hora */}
            <div className="space-y-2">
              <Label htmlFor="time" className="text-sm font-semibold">Hora de inicio *</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="h-12 text-base rounded-xl"
              />
            </div>

            {/* Duración */}
            <div className="space-y-2">
              <Label htmlFor="duration" className="text-sm font-semibold">Duración</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger id="duration" className="h-12 text-base rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                  <SelectItem value="90">90 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Modalidad */}
            <div className="space-y-2">
              <Label htmlFor="modality" className="text-sm font-semibold">Modalidad</Label>
              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger id="modality" className="h-12 text-base rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ubicación/Link */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-sm font-semibold">
                {modality === "online" ? "Link de videollamada" : "Dirección"}
              </Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={
                  modality === "online"
                    ? "https://meet.google.com/..."
                    : "Dirección del consultorio"
                }
                className="h-12 text-base rounded-xl"
              />
            </div>

            {/* Notas */}
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold">Notas internas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Notas solo visibles para el profesional"
                className="text-base rounded-xl resize-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="h-12 rounded-xl text-base font-semibold flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 rounded-xl text-base font-semibold flex-1"
            >
              {loading ? "Creando..." : "Crear cita"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

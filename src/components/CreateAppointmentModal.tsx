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

interface Patient {
  id: string;
  full_name: string;
}

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string | null;
  onSuccess: () => void;
}

export function CreateAppointmentModal({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: CreateAppointmentModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientId || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [modality, setModality] = useState("presencial");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) return;

      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("business_id", business.id)
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

      // Get current user's business
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const { data: business } = await supabase
        .from("businesses")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();

      if (!business) throw new Error("No se encontró el consultorio");

      // Calculate start_at and end_at
      const startAt = new Date(`${date}T${time}`);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + parseInt(duration));

      // Insert appointment
      const { error } = await supabase.from("appointments").insert({
        business_id: business.id,
        patient_id: selectedPatientId,
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

      // Reset form
      setDate("");
      setTime("");
      setDuration("60");
      setModality("presencial");
      setLocation("");
      setNotes("");
      setSelectedPatientId(patientId || "");
      
      onOpenChange(false);
      onSuccess();
      
      // Navigate to agenda
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

            {/* Fecha */}
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-semibold">Fecha *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="h-12 text-base rounded-xl"
              />
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
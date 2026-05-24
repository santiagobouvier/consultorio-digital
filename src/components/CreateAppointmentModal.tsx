import { useState, useEffect, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { notifyPatient } from "@/lib/push-notifications";
import { addDays, addWeeks, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import { Repeat, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";
type RecurrenceEndType = "count" | "date";

function generateRecurrenceDates(
  startDate: Date,
  frequency: RecurrenceFrequency,
  endType: RecurrenceEndType,
  count: number,
  endDate: Date | undefined
): Date[] {
  const dates: Date[] = [];
  const maxDates = 52;
  let current = startDate;

  for (let i = 0; i < maxDates; i++) {
    if (i > 0) {
      if (frequency === "weekly") current = addWeeks(startDate, i);
      else if (frequency === "biweekly") current = addWeeks(startDate, i * 2);
      else current = addMonths(startDate, i);
    }

    if (endType === "count" && dates.length >= count) break;
    if (endType === "date" && endDate && current > endDate) break;

    dates.push(current);
  }

  return dates;
}

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
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("weekly");
  const [recurrenceEndType, setRecurrenceEndType] = useState<RecurrenceEndType>("count");
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();
  const [sessionPrice, setSessionPrice] = useState<string>("");
  const [defaultPrice, setDefaultPrice] = useState<number | null>(null);

  // Prefill date when modal opens with a prefilledDate
  useEffect(() => {
    if (open && prefilledDate) {
      const yyyy = prefilledDate.getFullYear();
      const mm = String(prefilledDate.getMonth() + 1).padStart(2, "0");
      const dd = String(prefilledDate.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [open, prefilledDate]);

  // Cada profesional crea SOLO sus propias citas.
  // Forzamos professional_id = auth.uid() siempre.
  useEffect(() => {
    if (!open) return;
    if (currentUserId) setSelectedProfessionalId(currentUserId);
  }, [open, currentUserId]);

  useEffect(() => {
    if (open && !patientId) {
      fetchPatients();
    }
    if (patientId) {
      setSelectedPatientId(patientId);
    }
  }, [open, patientId]);

  // Cargar tarifa default del consultorio y precargar input
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
        setSessionPrice(String(v));
      } else {
        setDefaultPrice(null);
        setSessionPrice("");
      }
    })();
  }, [open, businessId]);

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

  const recurrenceDates = useMemo(() => {
    if (!isRecurrent || !date) return [];
    const startDate = new Date(`${date}T00:00:00`);
    if (isNaN(startDate.getTime())) return [];
    return generateRecurrenceDates(
      startDate,
      recurrenceFrequency,
      recurrenceEndType,
      recurrenceCount,
      recurrenceEndDate
    );
  }, [isRecurrent, date, recurrenceFrequency, recurrenceEndType, recurrenceCount, recurrenceEndDate]);

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

    // Cada profesional solo puede crear citas para sí mismo
    const finalProfessionalId = currentUserId;

    if (!finalProfessionalId) {
      toast({
        title: "Sin profesional asignado",
        description: "No se encontró un profesional disponible para asignar la cita",
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

      if (isRecurrent && recurrenceDates.length > 1) {
        const groupId = crypto.randomUUID();
        const durationMs = parseInt(duration) * 60 * 1000;
        const rows = recurrenceDates.map((d) => {
          const s = new Date(d);
          s.setHours(startAt.getHours(), startAt.getMinutes(), 0, 0);
          const e = new Date(s.getTime() + durationMs);
          return {
            business_id: businessId,
            patient_id: selectedPatientId,
            professional_id: finalProfessionalId,
            start_at: s.toISOString(),
            end_at: e.toISOString(),
            modality,
            location: location.trim() || null,
            notes: notes.trim() || null,
            status: "pending" as const,
            payment_status: "pendiente",
            recurrence_group_id: groupId,
            session_price: sessionPrice ? Number(sessionPrice) : null,
          };
        });
        const { error } = await supabase.from("appointments").insert(rows as any);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("appointments").insert({
          business_id: businessId,
          patient_id: selectedPatientId,
          professional_id: finalProfessionalId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          modality,
          location: location.trim() || null,
          notes: notes.trim() || null,
          status: "pending",
          payment_status: "pendiente",
          session_price: sessionPrice ? Number(sessionPrice) : null,
        } as any);
        if (error) throw error;
      }

      // Best-effort confirmation email (does not block flow)
      try {
        const { data: pat } = await supabase
          .from("patients")
          .select("full_name, email")
          .eq("id", selectedPatientId)
          .maybeSingle();

        if (pat?.email) {
          const fmtDate = startAt.toLocaleDateString("es-UY", {
            weekday: "long", day: "2-digit", month: "long", year: "numeric",
          });
          const fmtTime = startAt.toLocaleTimeString("es-UY", {
            hour: "2-digit", minute: "2-digit",
          });
          await supabase.functions.invoke("send-resend-email", {
            body: {
              to: pat.email,
              template: "appointment_confirmation",
              businessId,
              data: {
                patientName: pat.full_name,
                date: fmtDate,
                time: fmtTime,
                modality,
                location: location.trim() || null,
              },
            },
          });
        }
      } catch (mailErr) {
        console.warn("Confirmation email failed:", mailErr);
      }

      // Best-effort push notification to patient
      const fmtPushDate = startAt.toLocaleDateString("es-UY", { day: "2-digit", month: "long" });
      const fmtPushTime = startAt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
      notifyPatient({
        patientId: selectedPatientId,
        title: "Nueva cita agendada",
        body: `Tenés una cita el ${fmtPushDate} a las ${fmtPushTime}.`,
        url: "/portal",
      });

      toast({
        title: "Éxito",
        description: isRecurrent && recurrenceDates.length > 1
          ? `Se crearon ${recurrenceDates.length} citas recurrentes`
          : "Cita creada correctamente",
      });

      setDate("");
      setTime("");
      setDuration("60");
      setModality("presencial");
      setLocation("");
      setNotes("");
      setIsRecurrent(false);
      setRecurrenceFrequency("weekly");
      setRecurrenceEndType("count");
      setRecurrenceCount(4);
      setRecurrenceEndDate(undefined);
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

  const showProfessionalSelector = false;
  const singleProfessional = professionals.find((p) => p.userId === currentUserId) ?? null;

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

            {/* Asignación automática: cada profesional crea solo sus propias citas */}
            {singleProfessional && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2.5">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: singleProfessional.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Profesional asignado</p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {singleProfessional.name}
                  </p>
                </div>
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

            {/* Recurrencia */}
            <div className="space-y-3 p-4 border rounded-xl bg-muted/30">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="recurrent"
                  checked={isRecurrent}
                  onCheckedChange={(v) => setIsRecurrent(v === true)}
                />
                <Label htmlFor="recurrent" className="text-sm font-semibold flex items-center gap-2 cursor-pointer">
                  <Repeat className="h-4 w-4" />
                  Turno recurrente
                </Label>
              </div>

              {isRecurrent && (
                <div className="space-y-4 pt-2">
                  {/* Frecuencia */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Frecuencia</Label>
                    <Select value={recurrenceFrequency} onValueChange={(v) => setRecurrenceFrequency(v as RecurrenceFrequency)}>
                      <SelectTrigger className="h-12 text-base rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quincenal</SelectItem>
                        <SelectItem value="monthly">Mensual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Fin de recurrencia */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Termina</Label>
                    <Select value={recurrenceEndType} onValueChange={(v) => setRecurrenceEndType(v as RecurrenceEndType)}>
                      <SelectTrigger className="h-12 text-base rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Después de X sesiones</SelectItem>
                        <SelectItem value="date">En una fecha límite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {recurrenceEndType === "count" ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Cantidad de sesiones</Label>
                      <Input
                        type="number"
                        min={2}
                        max={52}
                        value={recurrenceCount}
                        onChange={(e) => setRecurrenceCount(Math.min(52, Math.max(2, parseInt(e.target.value) || 2)))}
                        className="h-12 text-base rounded-xl"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Fecha límite</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full h-12 justify-start text-left text-base rounded-xl",
                              !recurrenceEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {recurrenceEndDate
                              ? format(recurrenceEndDate, "PPP", { locale: es })
                              : "Elegir fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recurrenceEndDate}
                            onSelect={setRecurrenceEndDate}
                            disabled={(d) => d < new Date()}
                            locale={es}
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}

                  {/* Preview de fechas */}
                  {recurrenceDates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Vista previa ({recurrenceDates.length} sesiones)
                      </Label>
                      <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border p-3 bg-background">
                        {recurrenceDates.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                            <span className="capitalize">
                              {format(d, "EEEE d 'de' MMMM", { locale: es })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
              {loading
                ? "Creando..."
                : isRecurrent && recurrenceDates.length > 1
                  ? `Crear ${recurrenceDates.length} citas`
                  : "Crear cita"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

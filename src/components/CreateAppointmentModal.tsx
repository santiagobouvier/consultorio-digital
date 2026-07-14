import { useState, useEffect, useMemo, useCallback } from "react";
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
import { addWeeks, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Repeat, CalendarIcon, ArrowLeft, Search, Clock, Video, MapPin,
  Loader2, CheckCircle2, User, PencilLine,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Crear cita desde el panel, con la misma experiencia que la web pública:
// 1) paciente → 2) tipo de sesión → 3) día y horario (horarios libres
// calculados por el motor, con opción "Otro horario" manual porque el
// profesional puede agendar fuera de su semana tipo) → 4) confirmar.

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";
type RecurrenceEndType = "count" | "date";
type Step = "patient" | "service" | "schedule" | "confirm";

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

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  mode: string; // 'online' | 'presencial' | 'ambas'
  suggested_price: number | null;
}

interface Start {
  day: string;        // YYYY-MM-DD
  start_time: string; // HH:MM:SS
}

const CUSTOM_SERVICE = "custom";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const parseDay = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { date: new Date(y, m - 1, d), d, m };
};

const formatDayLong = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dd = new Date(y, m - 1, d);
  return `${DAY_NAMES[dd.getDay()]} ${d} de ${MONTH_NAMES[m - 1]}`;
};

const MODE_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  ambas: "Online o presencial",
};

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
  const { currentUserId } = useProfessionals(businessId);

  const [step, setStep] = useState<Step>("patient");
  const [loading, setLoading] = useState(false);

  // Paso 1: paciente
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientId || "");
  const [patientSearch, setPatientSearch] = useState("");

  // Paso 2: tipo de sesión
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(CUSTOM_SERVICE);
  const [duration, setDuration] = useState("60");
  const [defaultPrice, setDefaultPrice] = useState<number | null>(null);

  // Paso 3: día y horario
  const [scheduleMode, setScheduleMode] = useState<"slots" | "manual">("slots");
  const [starts, setStarts] = useState<Start[]>([]);
  const [startsLoading, setStartsLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  // Paso 4: confirmar
  const [modality, setModality] = useState("presencial");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [sessionPrice, setSessionPrice] = useState<string>("");
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("weekly");
  const [recurrenceEndType, setRecurrenceEndType] = useState<RecurrenceEndType>("count");
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) ?? null;

  // ── Carga inicial al abrir ──
  useEffect(() => {
    if (!open || !businessId) return;
    (async () => {
      const [bizRes, svcRes, patRes] = await Promise.all([
        supabase
          .from("businesses")
          .select("default_session_price")
          .eq("id", businessId)
          .maybeSingle(),
        (supabase as any)
          .from("services")
          .select("id, name, duration_minutes, mode, suggested_price")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("patients")
          .select("id, full_name")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("full_name"),
      ]);

      const v = (bizRes.data as any)?.default_session_price;
      setDefaultPrice(v != null ? Number(v) : null);
      setServices((svcRes.data ?? []) as ServiceOption[]);
      setPatients((patRes.data ?? []) as Patient[]);
    })();
  }, [open, businessId]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setStep(patientId ? "service" : "patient");
    setSelectedPatientId(patientId || "");
    setPatientSearch("");
    setSelectedServiceId(CUSTOM_SERVICE);
    setScheduleMode("slots");
    setStarts([]);
    setSelectedDay(null);
    setTime("");
    setModality("presencial");
    setLocation("");
    setNotes("");
    setSessionPrice("");
    setIsRecurrent(false);
    setRecurrenceFrequency("weekly");
    setRecurrenceEndType("count");
    setRecurrenceCount(4);
    setRecurrenceEndDate(undefined);
    if (prefilledDate) {
      const yyyy = prefilledDate.getFullYear();
      const mm = String(prefilledDate.getMonth() + 1).padStart(2, "0");
      const dd = String(prefilledDate.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setDate("");
    }
  }, [open, patientId, prefilledDate]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [patients, patientSearch]);

  // ── Horarios libres del motor (semana tipo + sueltos − citas) ──
  const loadStarts = useCallback(async (durationMinutes: number) => {
    if (!businessId || !currentUserId) return;
    setStartsLoading(true);
    try {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);
      const toDate = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await (supabase as any).rpc("get_available_starts", {
        p_business_id: businessId,
        p_professional_user_id: currentUserId,
        p_duration_minutes: durationMinutes,
        p_from: from,
        p_to: toDate,
      });
      if (error) throw error;
      setStarts((data ?? []) as Start[]);
    } catch (e) {
      console.error("Error cargando horarios libres:", e);
      setStarts([]);
    } finally {
      setStartsLoading(false);
    }
  }, [businessId, currentUserId]);

  // ── Elegir tipo de sesión ──
  // Tocar un tipo avanza directo al horario (como la web pública);
  // "Personalizada" pide la duración y sigue con el botón Continuar.
  const pickService = (svcId: string) => {
    setSelectedServiceId(svcId);
    if (svcId !== CUSTOM_SERVICE) {
      const svc = services.find((s) => s.id === svcId);
      if (svc) {
        setDuration(String(svc.duration_minutes));
        if (svc.mode === "online") setModality("online");
        else if (svc.mode === "presencial") setModality("presencial");
        const price = svc.suggested_price ?? defaultPrice;
        setSessionPrice(price != null ? String(price) : "");
        setScheduleMode("slots");
        setSelectedDay(null);
        setStep("schedule");
        void loadStarts(svc.duration_minutes);
      }
    } else {
      setSessionPrice(defaultPrice != null ? String(defaultPrice) : "");
    }
  };

  const goToSchedule = () => {
    setScheduleMode("slots");
    setSelectedDay(null);
    setStep("schedule");
    void loadStarts(parseInt(duration));
  };

  const startsByDate = useMemo(() => {
    const map = new Map<string, Start[]>();
    for (const s of starts) {
      const list = map.get(s.day) ?? [];
      list.push(s);
      map.set(s.day, list);
    }
    return Array.from(map.entries())
      .map(([day, items]) => ({
        day,
        items: [...items].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [starts]);

  // Día por defecto en la tira: el prefijado desde la agenda si tiene lugar,
  // sino el primero con disponibilidad.
  useEffect(() => {
    if (step !== "schedule" || scheduleMode !== "slots") return;
    if (startsByDate.length === 0) {
      setSelectedDay(null);
      return;
    }
    if (!selectedDay || !startsByDate.some((d) => d.day === selectedDay)) {
      const prefilled = date && startsByDate.some((d) => d.day === date) ? date : startsByDate[0].day;
      setSelectedDay(prefilled);
    }
  }, [step, scheduleMode, startsByDate, selectedDay, date]);

  const timesForSelectedDay = useMemo(
    () => startsByDate.find((d) => d.day === selectedDay)?.items ?? [],
    [startsByDate, selectedDay]
  );

  const pickStart = (s: Start) => {
    setDate(s.day);
    setTime(s.start_time.slice(0, 5));
    setStep("confirm");
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

  // ── Crear la cita ──
  const handleSubmit = async () => {
    if (!date || !time || !selectedPatientId) return;

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
      const serviceId = selectedServiceId !== CUSTOM_SERVICE ? selectedServiceId : null;

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
            service_id: serviceId,
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
          service_id: serviceId,
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

  const handleBack = () => {
    if (step === "confirm") setStep("schedule");
    else if (step === "schedule") setStep("service");
    else if (step === "service" && !patientId) setStep("patient");
  };

  const showBack =
    step === "confirm" || step === "schedule" || (step === "service" && !patientId);

  const STEP_TITLES: Record<Step, string> = {
    patient: "¿Para qué paciente?",
    service: "Tipo de sesión",
    schedule: "Día y horario",
    confirm: "Confirmá la cita",
  };

  const stepNumber = { patient: 1, service: patientId ? 1 : 2, schedule: patientId ? 2 : 3, confirm: patientId ? 3 : 4 }[step];
  const totalSteps = patientId ? 3 : 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pb-1">
          <div className="flex items-center gap-2">
            {showBack && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-8 w-8 rounded-lg -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-lg font-bold flex-1">{STEP_TITLES[step]}</DialogTitle>
            <span className="text-xs text-muted-foreground shrink-0">
              {stepNumber}/{totalSteps}
            </span>
          </div>
        </DialogHeader>

        {/* ── Paso: paciente ── */}
        {step === "patient" && (
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No se encontraron pacientes.
                </p>
              ) : (
                filteredPatients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setStep("service");
                    }}
                    className="w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.99]"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium text-sm">{p.full_name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Paso: tipo de sesión ── */}
        {step === "service" && (
          <div className="space-y-3 py-2">
            {selectedPatient && (
              <p className="text-xs text-muted-foreground">
                Paciente: <span className="font-medium text-foreground">{selectedPatient.full_name}</span>
              </p>
            )}
            <div className="grid grid-cols-1 gap-2.5">
              {services.map((s) => {
                const isSelected = selectedServiceId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pickService(s.id)}
                    className={cn(
                      "text-left rounded-xl border-2 p-3.5 transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {s.mode === "online" ? <Video className="h-3.5 w-3.5" /> : s.mode === "presencial" ? <MapPin className="h-3.5 w-3.5" /> : null}
                        {MODE_LABEL[s.mode] ?? s.mode}
                      </span>
                      {s.suggested_price != null && (
                        <span className="font-semibold text-primary">
                          ${s.suggested_price.toLocaleString("es-UY")}
                        </span>
                      )}
                    </p>
                  </button>
                );
              })}

              {/* Personalizada */}
              <button
                type="button"
                onClick={() => pickService(CUSTOM_SERVICE)}
                className={cn(
                  "text-left rounded-xl border-2 border-dashed p-3.5 transition-all",
                  selectedServiceId === CUSTOM_SERVICE
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-primary/40"
                )}
              >
                <p className="font-semibold text-sm inline-flex items-center gap-2">
                  <PencilLine className="h-4 w-4" /> Personalizada
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Duración y precio a medida, sin tipo de sesión.
                </p>
              </button>
            </div>

            {selectedServiceId === CUSTOM_SERVICE && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Duración</Label>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutos</SelectItem>
                    <SelectItem value="45">45 minutos</SelectItem>
                    <SelectItem value="60">60 minutos</SelectItem>
                    <SelectItem value="90">90 minutos</SelectItem>
                    <SelectItem value="120">120 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedServiceId === CUSTOM_SERVICE && (
              <Button onClick={goToSchedule} className="w-full h-11 rounded-xl font-semibold">
                Continuar
              </Button>
            )}
          </div>
        )}

        {/* ── Paso: día y horario ── */}
        {step === "schedule" && (
          <div className="space-y-4 py-2">
            {scheduleMode === "slots" ? (
              <>
                {startsLoading ? (
                  <div className="py-10 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Buscando horarios libres...
                  </div>
                ) : startsByDate.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium">No hay horarios libres en los próximos 30 días</p>
                    <p className="text-xs text-muted-foreground">
                      Podés elegir el horario a mano igual.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Tira de días con lugar */}
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                      {startsByDate.map(({ day }) => {
                        const { date: d, d: dayNum, m } = parseDay(day);
                        const isSelected = selectedDay === day;
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            className={cn(
                              "flex flex-col items-center justify-center rounded-xl border-2 px-3 py-2 min-w-[60px] snap-start transition-all",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card"
                            )}
                          >
                            <span className={cn("text-[10px] uppercase tracking-wide", !isSelected && "text-muted-foreground")}>
                              {DAY_SHORT[d.getDay()]}
                            </span>
                            <span className="text-base font-bold leading-tight">{dayNum}</span>
                            <span className={cn("text-[10px]", !isSelected && "text-muted-foreground")}>
                              {MONTH_SHORT[m - 1]}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Horarios del día */}
                    {selectedDay && (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold">{formatDayLong(selectedDay)}</p>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {timesForSelectedDay.map((s) => (
                            <button
                              key={`${s.day}-${s.start_time}`}
                              type="button"
                              onClick={() => pickStart(s)}
                              className="px-2 py-2.5 rounded-md border-2 border-primary/30 bg-primary/5 text-primary text-sm font-medium transition-all hover:bg-primary hover:text-primary-foreground"
                            >
                              {s.start_time.slice(0, 5)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setScheduleMode("manual")}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-1"
                >
                  Otro horario (elegir a mano)
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Elegí cualquier fecha y hora, incluso fuera de tu semana tipo.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="manual-date" className="text-sm font-semibold">Fecha *</Label>
                  <Input
                    id="manual-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    disabled={lockDate && !!prefilledDate}
                    className="h-11 rounded-xl disabled:opacity-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-time" className="text-sm font-semibold">Hora de inicio *</Label>
                  <Input
                    id="manual-time"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button
                  onClick={() => setStep("confirm")}
                  disabled={!date || !time}
                  className="w-full h-11 rounded-xl font-semibold"
                >
                  Continuar
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setScheduleMode("slots");
                    if (starts.length === 0) void loadStarts(parseInt(duration));
                  }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-1"
                >
                  Volver a los horarios libres
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Paso: confirmar ── */}
        {step === "confirm" && (
          <div className="space-y-4 py-2">
            {/* Resumen */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3.5 space-y-1">
              <p className="text-sm font-semibold inline-flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                {date ? formatDayLong(date) : ""} · {time} hs
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedPatient?.full_name}
                {" · "}
                {selectedService ? `${selectedService.name} (${duration} min)` : `Personalizada (${duration} min)`}
              </p>
            </div>

            {/* Modalidad */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Modalidad</Label>
              <div className="flex gap-2">
                {(["presencial", "online"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModality(m)}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-medium transition-all",
                      modality === m
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border text-muted-foreground"
                    )}
                  >
                    {m === "online" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                    {m === "online" ? "Online" : "Presencial"}
                  </button>
                ))}
              </div>
            </div>

            {/* Ubicación/Link */}
            <div className="space-y-1.5">
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
                className="h-11 rounded-xl"
              />
            </div>

            {/* Precio */}
            <div className="space-y-1.5">
              <Label htmlFor="session_price" className="text-sm font-semibold">Monto de la sesión (UYU)</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="session_price"
                  type="number"
                  min="0"
                  step="1"
                  value={sessionPrice}
                  onChange={(e) => setSessionPrice(e.target.value)}
                  placeholder={defaultPrice ? String(defaultPrice) : "0"}
                  className="h-11 rounded-xl pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Se genera un pago pendiente vinculado a esta cita. Dejá en blanco si no querés cobrar.
              </p>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-sm font-semibold">Notas internas</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Notas solo visibles para el profesional"
                className="rounded-xl resize-none"
              />
            </div>

            {/* Recurrencia */}
            <div className="space-y-3 p-3.5 border rounded-xl bg-muted/30">
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
                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Frecuencia</Label>
                    <Select value={recurrenceFrequency} onValueChange={(v) => setRecurrenceFrequency(v as RecurrenceFrequency)}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quincenal</SelectItem>
                        <SelectItem value="monthly">Mensual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Termina</Label>
                    <Select value={recurrenceEndType} onValueChange={(v) => setRecurrenceEndType(v as RecurrenceEndType)}>
                      <SelectTrigger className="h-11 rounded-xl">
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
                        className="h-11 rounded-xl"
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
                              "w-full h-11 justify-start text-left rounded-xl",
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

                  {recurrenceDates.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">
                        Vista previa ({recurrenceDates.length} sesiones)
                      </Label>
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-xl border p-3 bg-background">
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

            <Button
              onClick={handleSubmit}
              disabled={loading || !date || !time || !selectedPatientId}
              className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  {isRecurrent && recurrenceDates.length > 1
                    ? `Crear ${recurrenceDates.length} citas`
                    : "Crear cita"}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

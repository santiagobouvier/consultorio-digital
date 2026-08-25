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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/hooks/use-toast";
import { useBusinessId } from "@/hooks/use-business-id";
import { useProfessionals } from "@/hooks/use-professionals";
import { useIsMobile } from "@/hooks/use-mobile";
import { notifyPatient } from "@/lib/push-notifications";
import { addWeeks, addMonths, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Repeat, CalendarIcon, ArrowLeft, Search, Clock, Video, MapPin,
  Loader2, CheckCircle2, User, PencilLine, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Asistente de cita: el sistema pregunta y vos contestás tocando bloques
// grandes, en el orden natural del profesional:
// 1) ¿Cuándo? (día + horario libre del motor, u "otro horario" manual)
// 2) ¿Qué sesión? (tipo con su duración — se revalida que entre en el hueco)
// 3) ¿Con quién? (paciente)
// 4) Confirmar (modalidad + precio; lo demás vive en "Más opciones").
// En celular es un bottom-sheet a pantalla (casi) completa.

type RecurrenceFrequency = "weekly" | "biweekly" | "monthly";
type ChargeMode = "per_session" | "monthly" | "none";
type Step = "schedule" | "service" | "patient" | "confirm";

function generateRecurrenceDates(
  startDate: Date,
  frequency: RecurrenceFrequency,
  count: number
): Date[] {
  const dates: Date[] = [];
  const capped = Math.min(count, 52);
  for (let i = 0; i < capped; i++) {
    if (i === 0) {
      dates.push(startDate);
    } else if (frequency === "weekly") {
      dates.push(addWeeks(startDate, i));
    } else if (frequency === "biweekly") {
      dates.push(addWeeks(startDate, i * 2));
    } else {
      dates.push(addMonths(startDate, i));
    }
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
  /** Hora tocada en la grilla de la agenda ("15:30"): se resalta ese
   *  horario entre los libres y se precarga en el modo manual. */
  prefilledTime?: string | null;
}

export function CreateAppointmentModal({
  open,
  onOpenChange,
  patientId,
  onSuccess,
  prefilledDate,
  lockDate = false,
  prefilledTime = null,
}: CreateAppointmentModalProps) {
  const navigate = useNavigate();
  const { businessId } = useBusinessId();
  const { currentUserId } = useProfessionals(businessId);
  const isMobile = useIsMobile();

  const [step, setStep] = useState<Step>("schedule");
  const [loading, setLoading] = useState(false);

  // Datos base
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(patientId || "");
  const [patientSearch, setPatientSearch] = useState("");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(CUSTOM_SERVICE);
  const [duration, setDuration] = useState("60");
  const [defaultPrice, setDefaultPrice] = useState<number | null>(null);

  // Paso ¿Cuándo?
  const [scheduleMode, setScheduleMode] = useState<"slots" | "manual">("slots");
  const [starts, setStarts] = useState<Start[]>([]);
  const [startsLoading, setStartsLoading] = useState(false);
  // Duración con la que se calcularon los horarios libres (para revalidar
  // si después se elige una sesión más larga)
  const [slotsDur, setSlotsDur] = useState(60);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  // Día tocado en la agenda sin lugar: permitir mirar otros días
  const [dayUnlocked, setDayUnlocked] = useState(false);

  // Paso confirmar
  const [modality, setModality] = useState("presencial");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [patientNote, setPatientNote] = useState("");
  const [sessionPrice, setSessionPrice] = useState<string>("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>("weekly");
  const [countChoice, setCountChoice] = useState<"4" | "8" | "12" | "custom">("8");
  const [customCount, setCustomCount] = useState(6);
  const [showDates, setShowDates] = useState(false);
  const [chargeMode, setChargeMode] = useState<ChargeMode>("per_session");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [monthlyDay, setMonthlyDay] = useState("1");

  const recurrenceCount = countChoice === "custom" ? customCount : parseInt(countChoice);
  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) ?? null;

  // ── Horarios libres del motor (semana tipo + sueltos − citas) ──
  const loadStarts = useCallback(async (durationMinutes: number, ignoreLock = false) => {
    if (!businessId || !currentUserId) return;
    setStartsLoading(true);
    setSlotsDur(durationMinutes);
    try {
      const today = new Date();
      const locked = lockDate && prefilledDate && !ignoreLock;
      const from = (locked ? prefilledDate! : today).toISOString().slice(0, 10);
      const toDate = (locked
        ? prefilledDate!
        : new Date(today.getTime() + 180 * 86400000)
      ).toISOString().slice(0, 10);
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
  }, [businessId, currentUserId, lockDate, prefilledDate]);

  // ── Carga inicial al abrir ──
  useEffect(() => {
    if (!open || !businessId) return;
    (async () => {
      setPatientsLoading(true);
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
      const svcs = (svcRes.data ?? []) as ServiceOption[];
      setServices(svcs);
      setPatients((patRes.data ?? []) as Patient[]);
      setPatientsLoading(false);

      // Los horarios se muestran con la sesión más corta que ofrecés: así
      // aparecen TODOS los inicios posibles. Si después elegís una sesión
      // más larga, se revalida que entre.
      const minDur = svcs.length > 0 ? Math.min(...svcs.map((s) => s.duration_minutes)) : 60;
      void loadStarts(minDur);
    })();
  }, [open, businessId, loadStarts]);

  // Reset al abrir
  useEffect(() => {
    if (!open) return;
    setStep("schedule");
    setSelectedPatientId(patientId || "");
    setPatientSearch("");
    setSelectedServiceId(CUSTOM_SERVICE);
    setScheduleMode("slots");
    setStarts([]);
    setSelectedDay(null);
    setDayUnlocked(false);
    setTime(prefilledTime ?? "");
    setModality("presencial");
    setLocation("");
    setNotes("");
    setPatientNote("");
    setSessionPrice("");
    setMoreOpen(false);
    setIsRecurrent(false);
    setRecurrenceFrequency("weekly");
    setCountChoice("8");
    setCustomCount(6);
    setShowDates(false);
    setChargeMode("per_session");
    setMonthlyAmount("");
    setMonthlyDay("1");
    if (prefilledDate) {
      const yyyy = prefilledDate.getFullYear();
      const mm = String(prefilledDate.getMonth() + 1).padStart(2, "0");
      const dd = String(prefilledDate.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
    } else {
      setDate("");
    }
  }, [open, patientId, prefilledDate, prefilledTime]);

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter((p) => p.full_name.toLowerCase().includes(q));
  }, [patients, patientSearch]);

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

  // Día por defecto: el prefijado desde la agenda si tiene lugar, sino el
  // primero con disponibilidad.
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
    setStep("service");
  };

  // ── Elegir tipo de sesión (con revalidación del hueco) ──
  const afterService = () => setStep(patientId ? "confirm" : "patient");

  const pickService = async (svcId: string) => {
    setSelectedServiceId(svcId);
    if (svcId === CUSTOM_SERVICE) {
      setSessionPrice(defaultPrice != null ? String(defaultPrice) : "");
      return; // pide duración y sigue con Continuar
    }
    const svc = services.find((s) => s.id === svcId);
    if (!svc) return;
    setDuration(String(svc.duration_minutes));
    if (svc.mode === "online") setModality("online");
    else if (svc.mode === "presencial") setModality("presencial");
    const price = svc.suggested_price ?? defaultPrice;
    setSessionPrice(price != null ? String(price) : "");
    await continueWithDuration(svc.duration_minutes);
  };

  /** Si la sesión elegida es más larga que la usada para calcular los
   *  horarios, revalida que el hueco alcance; si no, vuelve a ¿Cuándo? */
  const continueWithDuration = async (dur: number) => {
    if (scheduleMode === "slots" && date && time && dur > slotsDur) {
      try {
        const { data } = await (supabase as any).rpc("get_available_starts", {
          p_business_id: businessId,
          p_professional_user_id: currentUserId,
          p_duration_minutes: dur,
          p_from: date,
          p_to: date,
        });
        const fits = (data ?? []).some((r: any) => String(r.start_time).slice(0, 5) === time);
        if (!fits) {
          toast({
            title: `Ese hueco no alcanza para ${dur} min`,
            description: "Te muestro los horarios donde sí entra esta sesión.",
          });
          setTime("");
          setStep("schedule");
          void loadStarts(dur, dayUnlocked);
          return;
        }
      } catch {
        // Si la validación falla, seguimos: el profesional manda
      }
    }
    afterService();
  };

  const recurrenceDates = useMemo(() => {
    if (!isRecurrent || !date) return [];
    const startDate = new Date(`${date}T00:00:00`);
    if (isNaN(startDate.getTime())) return [];
    return generateRecurrenceDates(startDate, recurrenceFrequency, recurrenceCount);
  }, [isRecurrent, date, recurrenceFrequency, recurrenceCount]);

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
      // Para contarle al usuario qué cobros generó la base junto con la(s) cita(s)
      let createdAppointmentIds: string[] = [];

      if (isRecurrent && recurrenceDates.length > 1) {
        // Cobro de la serie: por sesión = precio en cada cita (genera un pago
        // c/u); mensualidad o sin cobro = precio 0 (la base NO crea pagos por
        // cita; la mensualidad se registra aparte, una sola por mes).
        const seriesPrice =
          chargeMode === "per_session" ? (sessionPrice ? Number(sessionPrice) : null) : 0;

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
            patient_note: patientNote.trim() || null,
            status: "pending" as const,
            payment_status: "pendiente",
            recurrence_group_id: groupId,
            session_price: seriesPrice,
          };
        });
        const { data: insertedRows, error } = await supabase
          .from("appointments")
          .insert(rows as any)
          .select("id");
        if (error) throw error;
        createdAppointmentIds = (insertedRows || []).map((r: any) => r.id);

        // Mensualidad: un solo cobro por mes (si el paciente no tiene ya una)
        if (chargeMode === "monthly" && monthlyAmount && Number(monthlyAmount) > 0) {
          const { data: existing } = await supabase
            .from("payments")
            .select("id")
            .eq("business_id", businessId)
            .eq("patient_id", selectedPatientId)
            .eq("recurrence_type", "monthly")
            .is("paid_at", null)
            .neq("status", "cancelled")
            .limit(1)
            .maybeSingle();

          if (existing) {
            toast({
              title: "Mensualidad ya activa",
              description: "Este paciente ya tiene una mensualidad pendiente; no se creó otra.",
            });
          } else {
            const day = Math.min(28, Math.max(1, parseInt(monthlyDay) || 1));
            const now = new Date();
            let due = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0);
            if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, day, 12, 0, 0);
            const { error: payError } = await supabase.from("payments").insert({
              business_id: businessId,
              patient_id: selectedPatientId,
              amount: Number(monthlyAmount),
              currency: "UYU",
              due_date: due.toISOString(),
              status: "pending",
              recurrence_type: "monthly",
              anchor_day: day,
              notes: "Mensualidad",
            } as any);
            if (payError) {
              console.error("Error creando mensualidad:", payError);
              toast({
                title: "Aviso",
                description: "Las citas se crearon, pero no se pudo crear la mensualidad. Creala desde Pagos.",
                variant: "destructive",
              });
            }
          }
        }
      } else {
        const { data: insertedRow, error } = await supabase.from("appointments").insert({
          business_id: businessId,
          patient_id: selectedPatientId,
          professional_id: finalProfessionalId,
          service_id: serviceId,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
          modality,
          location: location.trim() || null,
          notes: notes.trim() || null,
          patient_note: patientNote.trim() || null,
          status: "pending",
          payment_status: "pendiente",
          session_price: sessionPrice ? Number(sessionPrice) : null,
        } as any).select("id").single();
        if (error) throw error;
        if (insertedRow?.id) createdAppointmentIds = [insertedRow.id];
      }

      // Best-effort confirmation email (does not block flow).
      // Serie: UN solo mail listando todas las fechas (no un mail por cita).
      const isSeries = isRecurrent && recurrenceDates.length > 1;
      try {
        const { data: pat } = await supabase
          .from("patients")
          .select("full_name, email")
          .eq("id", selectedPatientId)
          .maybeSingle();

        if (pat?.email) {
          const fmtTime = startAt.toLocaleTimeString("es-UY", {
            hour: "2-digit", minute: "2-digit",
          });

          if (isSeries) {
            const modLabel = modality === "online" ? "Online" : "Presencial";
            const dateLines = recurrenceDates
              .map((d, i) => `${i + 1}. ${format(d, "EEEE d 'de' MMMM", { locale: es })} a las ${fmtTime}`)
              .join("\n");
            await supabase.functions.invoke("send-resend-email", {
              body: {
                to: pat.email,
                template: "raw",
                businessId,
                data: {
                  subject: `Tus ${recurrenceDates.length} citas fueron agendadas`,
                  message:
                    `Hola ${pat.full_name},\n\n` +
                    `Se agendaron tus próximas ${recurrenceDates.length} sesiones (${modLabel}):\n\n` +
                    dateLines +
                    (location.trim() ? `\n\n${modality === "online" ? "Link" : "Dirección"}: ${location.trim()}` : "") +
                    `\n\nAntes de cada sesión te va a llegar un recordatorio. Si necesitás reprogramar alguna, contactá al consultorio.`,
                },
              },
            });
          } else {
            const fmtDate = startAt.toLocaleDateString("es-UY", {
              weekday: "long", day: "2-digit", month: "long", year: "numeric",
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
        }
      } catch (mailErr) {
        console.warn("Confirmation email failed:", mailErr);
      }

      // Best-effort push notification to patient
      const fmtPushDate = startAt.toLocaleDateString("es-UY", { day: "2-digit", month: "long" });
      const fmtPushTime = startAt.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
      notifyPatient({
        patientId: selectedPatientId,
        title: isSeries ? `${recurrenceDates.length} citas agendadas` : "Nueva cita agendada",
        body: isSeries
          ? `Tenés ${recurrenceDates.length} citas agendadas, la primera el ${fmtPushDate} a las ${fmtPushTime}.`
          : `Tenés una cita el ${fmtPushDate} a las ${fmtPushTime}.`,
        url: "/portal",
      });

      // El cobro sigue a la cita: la base lo crea sola. Acá le contamos al
      // usuario QUÉ se generó de verdad (consultando, no suponiendo).
      let cobroInfo = "";
      try {
        if (createdAppointmentIds.length > 0) {
          const { data: pays } = await supabase
            .from("payments")
            .select("amount")
            .in("appointment_id", createdAppointmentIds)
            .neq("status", "cancelled");
          if (pays && pays.length > 0) {
            const totalCobros = pays.reduce((s, p) => s + Number(p.amount), 0);
            cobroInfo = pays.length === 1
              ? ` El cobro de $${totalCobros.toLocaleString("es-UY")} ya quedó pendiente en Pagos.`
              : ` Se generaron ${pays.length} cobros en Pagos ($${totalCobros.toLocaleString("es-UY")} en total).`;
          } else if (chargeMode !== "monthly") {
            cobroInfo = " Sin cobro asociado: definí el precio del servicio o tu tarifa en Mi consultorio.";
          }
        }
      } catch { /* informativo, nunca bloquea */ }

      toast({
        title: isRecurrent && recurrenceDates.length > 1
          ? `${recurrenceDates.length} citas creadas`
          : "Cita creada",
        description: (isRecurrent && recurrenceDates.length > 1
          ? "La serie quedó en tu agenda."
          : "Quedó en tu agenda.") + cobroInfo,
      });

      onOpenChange(false);
      onSuccess();
      // Solo navegar a la agenda si no estamos ya en otra pantalla con
      // contexto (ej: la ficha del paciente refresca sola con onSuccess).
      if (window.location.pathname.startsWith("/agenda")) {
        navigate("/agenda");
      }
    } catch (error: any) {
      console.error("Error creating appointment:", error);
      // Índice único de la base: ya existe una cita activa en ese horario
      const isDuplicate = error?.code === "23505" || String(error?.message || "").includes("uniq_appointments_professional_start");
      toast({
        title: isDuplicate ? "Horario ocupado" : "Error",
        description: isDuplicate
          ? "Ya tenés una cita activa que empieza exactamente a esa hora. Elegí otro horario."
          : "No se pudo crear la cita",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "confirm") setStep(patientId ? "service" : "patient");
    else if (step === "patient") setStep("service");
    else if (step === "service") setStep("schedule");
  };

  const showBack = step !== "schedule";

  const STEP_TITLES: Record<Step, string> = {
    schedule: "¿Cuándo?",
    service: "¿Qué sesión?",
    patient: "¿Con quién?",
    confirm: "Confirmá y listo",
  };

  const STEP_ORDER: Step[] = patientId
    ? ["schedule", "service", "confirm"]
    : ["schedule", "service", "patient", "confirm"];
  const stepIndex = STEP_ORDER.indexOf(step);

  const body = (
    <>
      {/* Encabezado del asistente: atrás + pregunta + progreso */}
      <div className="flex items-center gap-2 pb-1">
        {showBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="h-9 w-9 rounded-lg -ml-2 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h2 className="text-lg font-bold flex-1 truncate">{STEP_TITLES[step]}</h2>
        <div className="flex items-center gap-1 shrink-0" aria-label={`Paso ${stepIndex + 1} de ${STEP_ORDER.length}`}>
          {STEP_ORDER.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i <= stepIndex ? "w-5 bg-primary" : "w-2.5 bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Lo ya elegido, siempre a la vista */}
      {(date && time) && step !== "schedule" && (
        <button
          type="button"
          onClick={() => setStep("schedule")}
          className="w-full flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 text-left mb-1"
        >
          <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">
            {formatDayLong(date)} · {time} hs
          </span>
          <PencilLine className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto" />
        </button>
      )}

      {/* ── Paso: ¿Cuándo? ── */}
      {step === "schedule" && (
        <div className="space-y-4 py-2">
          {scheduleMode === "slots" ? (
            <>
              {startsLoading ? (
                <div className="py-10 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Buscando tus horarios libres...
                </div>
              ) : startsByDate.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {lockDate && prefilledDate && !dayUnlocked
                      ? "Ese día no tiene horarios libres"
                      : "No hay horarios libres en los próximos 6 meses"}
                  </p>
                  {lockDate && prefilledDate && !dayUnlocked && (
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl"
                      onClick={() => {
                        setDayUnlocked(true);
                        void loadStarts(slotsDur, true);
                      }}
                    >
                      Ver otros días con lugar
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    O elegí el horario a mano, sin límites.
                  </p>
                </div>
              ) : (
                <>
                  {/* Días con lugar: tira deslizable en mobile, grilla que
                      envuelve en desktop */}
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x lg:flex-wrap lg:overflow-visible lg:pb-0 lg:snap-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {startsByDate.map(({ day }) => {
                      const { date: d, d: dayNum, m } = parseDay(day);
                      const isSelected = selectedDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={cn(
                            "flex flex-col items-center justify-center rounded-xl border-2 px-3 py-2 min-w-[64px] min-h-[64px] snap-start transition-all hover:border-primary/50",
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground hover:border-primary"
                              : "border-border bg-card"
                          )}
                        >
                          <span className={cn("text-[10px] uppercase tracking-wide", !isSelected && "text-muted-foreground")}>
                            {DAY_SHORT[d.getDay()]}
                          </span>
                          <span className="text-lg font-bold leading-tight">{dayNum}</span>
                          <span className={cn("text-[10px]", !isSelected && "text-muted-foreground")}>
                            {MONTH_SHORT[m - 1]}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Horarios del día: tocás uno y seguís */}
                  {selectedDay && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold capitalize">{formatDayLong(selectedDay)}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {timesForSelectedDay.map((s) => {
                          const isTapped =
                            !!prefilledTime && s.start_time.slice(0, 5) === prefilledTime;
                          return (
                            <button
                              key={`${s.day}-${s.start_time}`}
                              type="button"
                              onClick={() => pickStart(s)}
                              className={cn(
                                "h-12 rounded-xl border-2 text-[15px] font-semibold tabular-nums transition-all hover:bg-primary hover:text-primary-foreground",
                                isTapped
                                  ? "border-primary bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30"
                                  : "border-primary/30 bg-primary/5 text-primary"
                              )}
                            >
                              {s.start_time.slice(0, 5)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => setScheduleMode("manual")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-2 min-h-[44px]"
              >
                Otro horario (elegir a mano)
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Elegí cualquier fecha y hora, incluso fuera de tus cupos.
              </p>
              <div className="space-y-2">
                <Label htmlFor="manual-date" className="text-sm font-semibold">Fecha *</Label>
                <Input
                  id="manual-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={lockDate && !!prefilledDate && !dayUnlocked}
                  className="h-11 rounded-xl disabled:opacity-100"
                />
                {lockDate && !!prefilledDate && !dayUnlocked && (
                  <button
                    type="button"
                    onClick={() => setDayUnlocked(true)}
                    className="text-xs text-muted-foreground underline underline-offset-4"
                  >
                    Cambiar de día
                  </button>
                )}
                {date && (() => {
                  const picked = new Date(`${date}T00:00:00`);
                  const sixMonths = new Date();
                  sixMonths.setMonth(sixMonths.getMonth() + 6);
                  return picked > sixMonths ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Estás agendando a más de 6 meses. Verificá que la fecha sea correcta.
                    </p>
                  ) : null;
                })()}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Hora de inicio *</Label>
                {/* Selects propios (hora y minutos): el picker nativo del
                    navegador se veía roto en modo oscuro y era incómodo. */}
                <div className="flex items-center gap-2">
                  <Select
                    value={time ? time.split(":")[0] : undefined}
                    onValueChange={(h) => setTime(`${h}:${time.split(":")[1] || "00"}`)}
                  >
                    <SelectTrigger className="h-11 rounded-xl flex-1">
                      <SelectValue placeholder="Hora" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, "0")).map((h) => (
                        <SelectItem key={h} value={h}>{h} hs</SelectItem>
                      ))}
                      {["00", "01", "02", "03", "04", "05"].map((h) => (
                        <SelectItem key={h} value={h}>{h} hs</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-lg font-bold text-muted-foreground">:</span>
                  <Select
                    value={time ? (time.split(":")[1] || "00") : undefined}
                    onValueChange={(m) => setTime(`${time.split(":")[0] || "09"}:${m}`)}
                  >
                    <SelectTrigger className="h-11 rounded-xl flex-1">
                      <SelectValue placeholder="Minutos" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
                        <SelectItem key={m} value={m}>{m} min</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => setStep("service")}
                disabled={!date || !time}
                className="w-full h-12 rounded-xl font-semibold"
              >
                Continuar
              </Button>
              <button
                type="button"
                onClick={() => {
                  setScheduleMode("slots");
                  if (starts.length === 0) void loadStarts(slotsDur, dayUnlocked);
                }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 py-2 min-h-[44px]"
              >
                Volver a los horarios libres
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Paso: ¿Qué sesión? ── */}
      {step === "service" && (
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-1 gap-2.5">
            {services.map((s) => {
              const isSelected = selectedServiceId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void pickService(s.id)}
                  className={cn(
                    "text-left rounded-xl border-2 p-4 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <p className="font-semibold text-[15px]">{s.name}</p>
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
              onClick={() => void pickService(CUSTOM_SERVICE)}
              className={cn(
                "text-left rounded-xl border-2 border-dashed p-4 transition-all",
                selectedServiceId === CUSTOM_SERVICE
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <p className="font-semibold text-[15px] inline-flex items-center gap-2">
                <PencilLine className="h-4 w-4" /> Personalizada
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Duración y precio a medida, sin tipo de sesión.
              </p>
            </button>
          </div>

          {selectedServiceId === CUSTOM_SERVICE && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Duración</Label>
                <div className="grid grid-cols-5 gap-2">
                  {["30", "45", "60", "90", "120"].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={cn(
                        "h-11 rounded-xl border-2 text-sm font-semibold tabular-nums transition-all",
                        duration === d
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground"
                      )}
                    >
                      {d}’
                    </button>
                  ))}
                </div>
              </div>
              <Button
                onClick={() => void continueWithDuration(parseInt(duration))}
                className="w-full h-12 rounded-xl font-semibold"
              >
                Continuar
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Paso: ¿Con quién? ── */}
      {step === "patient" && (
        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="pl-10 h-12 rounded-xl text-[15px]"
            />
          </div>
          <div className="space-y-1.5 max-h-[45vh] overflow-y-auto">
            {patientsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando tus pacientes...
              </div>
            ) : patients.length === 0 ? (
              <div className="text-center py-8 space-y-1.5">
                <p className="text-sm font-medium text-foreground">Todavía no tenés pacientes cargados</p>
                <p className="text-xs text-muted-foreground">
                  Creá el primero desde el dashboard con "Nuevo paciente" y después agendale la cita.
                </p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Ningún paciente coincide con "{patientSearch}".
              </p>
            ) : (
              filteredPatients.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPatientId(p.id);
                    setStep("confirm");
                  }}
                  className="w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.99] min-h-[56px]"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-[15px]">{p.full_name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Paso: confirmar ── */}
      {step === "confirm" && (
        <div className="space-y-4 py-2">
          {/* Resumen */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-1">
            <p className="text-[15px] font-semibold inline-flex items-center gap-2 capitalize">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {date ? formatDayLong(date) : ""} · {time} hs
            </p>
            <p className="text-sm text-muted-foreground">
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
                    "flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 h-12 text-sm font-medium transition-all",
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

          {/* Precio (para cita única o serie cobrada por sesión) */}
          {(!isRecurrent || chargeMode === "per_session") && (
            <div className="space-y-1.5">
              <Label htmlFor="session_price" className="text-sm font-semibold">
                Monto {isRecurrent ? "de cada sesión" : "de la sesión"} (UYU)
              </Label>
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
                  className="h-12 rounded-xl pl-8 text-[15px]"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {isRecurrent
                  ? "Cada cita de la serie genera su cobro pendiente."
                  : "Se genera un pago pendiente vinculado a esta cita."}
              </p>
            </div>
          )}

          {/* Más opciones: link/dirección, notas y repetición — plegado
              para que confirmar sea UNA pantalla simple */}
          <div className="rounded-xl border overflow-hidden">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 p-3.5 text-left bg-muted/30"
            >
              <span className="text-sm font-semibold">
                Más opciones
                <span className="ml-2 font-normal text-xs text-muted-foreground">
                  {modality === "online" ? "link" : "dirección"}, notas, repetir
                </span>
              </span>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", moreOpen && "rotate-180")} />
            </button>

            {moreOpen && (
              <div className="p-3.5 space-y-4">
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

                {/* Notas: dos campos, dos destinos clarísimos */}
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
                <div className="space-y-1.5">
                  <Label htmlFor="patient-note" className="text-sm font-semibold">
                    Nota para el paciente
                    <span className="ml-2 font-normal text-xs text-muted-foreground">la ve en su portal</span>
                  </Label>
                  <Textarea
                    id="patient-note"
                    value={patientNote}
                    onChange={(e) => setPatientNote(e.target.value)}
                    rows={2}
                    placeholder='Ej: "Traé los estudios" — el paciente la ve en esta cita'
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
                      Repetir este turno
                    </Label>
                  </div>

                  {isRecurrent && (
                    <div className="space-y-4 pt-1">
                      {/* Se repite... */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Se repite</p>
                        <div className="grid grid-cols-3 gap-2">
                          {([
                            ["weekly", "Todas las semanas"],
                            ["biweekly", "Cada 15 días"],
                            ["monthly", "Una vez al mes"],
                          ] as const).map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setRecurrenceFrequency(value)}
                              className={cn(
                                "rounded-xl border-2 py-2.5 px-2 text-xs font-medium transition-all",
                                recurrenceFrequency === value
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-card text-muted-foreground"
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Durante... */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Durante</p>
                        <div className="grid grid-cols-4 gap-2">
                          {(["4", "8", "12"] as const).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCountChoice(c)}
                              className={cn(
                                "rounded-xl border-2 py-2.5 text-sm font-semibold transition-all",
                                countChoice === c
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-card text-muted-foreground"
                              )}
                            >
                              {c} <span className="font-normal text-[10px]">ses.</span>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setCountChoice("custom")}
                            className={cn(
                              "rounded-xl border-2 py-2.5 text-sm font-medium transition-all",
                              countChoice === "custom"
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-card text-muted-foreground"
                            )}
                          >
                            Otra
                          </button>
                        </div>
                        {countChoice === "custom" && (
                          <Input
                            type="number"
                            min={2}
                            max={52}
                            value={customCount}
                            onChange={(e) => setCustomCount(Math.min(52, Math.max(2, parseInt(e.target.value) || 2)))}
                            className="h-11 rounded-xl"
                            placeholder="Cantidad de sesiones"
                          />
                        )}
                      </div>

                      {/* Resumen en una línea */}
                      {recurrenceDates.length > 1 && (
                        <div className="text-xs text-muted-foreground">
                          <button
                            type="button"
                            onClick={() => setShowDates((v) => !v)}
                            className="hover:text-foreground underline underline-offset-4"
                          >
                            {recurrenceDates.length} sesiones · del {format(recurrenceDates[0], "d MMM", { locale: es })} al {format(recurrenceDates[recurrenceDates.length - 1], "d MMM", { locale: es })} · {showDates ? "ocultar fechas" : "ver fechas"}
                          </button>
                          {showDates && (
                            <div className="max-h-28 overflow-y-auto space-y-0.5 rounded-xl border p-2.5 bg-background mt-2">
                              {recurrenceDates.map((d, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground w-5 text-right">{i + 1}.</span>
                                  <span className="capitalize">{format(d, "EEEE d 'de' MMMM", { locale: es })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ¿Cómo lo cobrás? */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">¿Cómo lo cobrás?</p>
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setChargeMode("per_session")}
                            className={cn(
                              "w-full text-left rounded-xl border-2 p-3 transition-all",
                              chargeMode === "per_session"
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card"
                            )}
                          >
                            <p className="text-sm font-semibold">💵 Por sesión</p>
                            <p className="text-xs text-muted-foreground">
                              Cada cita genera su cobro individual.
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setChargeMode("monthly")}
                            className={cn(
                              "w-full text-left rounded-xl border-2 p-3 transition-all",
                              chargeMode === "monthly"
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card"
                            )}
                          >
                            <p className="text-sm font-semibold">📅 Mensualidad</p>
                            <p className="text-xs text-muted-foreground">
                              Un solo cobro por mes. Al cobrarlo, el del mes siguiente se genera solo.
                            </p>
                          </button>

                          {chargeMode === "monthly" && (
                            <div className="grid grid-cols-2 gap-2 pl-1">
                              <div className="space-y-1">
                                <Label className="text-xs">Monto mensual (UYU)</Label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={monthlyAmount}
                                    onChange={(e) => setMonthlyAmount(e.target.value)}
                                    placeholder="Ej: 4800"
                                    className="h-10 rounded-xl pl-7"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Día de cobro</Label>
                                <Select value={monthlyDay} onValueChange={setMonthlyDay}>
                                  <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 28 }, (_, i) => String(i + 1)).map((d) => (
                                      <SelectItem key={d} value={d}>El {d} de cada mes</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setChargeMode("none")}
                            className={cn(
                              "w-full text-left rounded-xl border-2 p-3 transition-all",
                              chargeMode === "none"
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card"
                            )}
                          >
                            <p className="text-sm font-semibold">🚫 Sin cobro</p>
                            <p className="text-xs text-muted-foreground">
                              Las citas no generan pagos (bonificado, convenio, etc.).
                            </p>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !date ||
              !time ||
              !selectedPatientId ||
              (isRecurrent && chargeMode === "monthly" && (!monthlyAmount || Number(monthlyAmount) <= 0))
            }
            className="w-full h-13 min-h-[52px] rounded-xl text-base font-bold gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                {isRecurrent && recurrenceDates.length > 1
                  ? `Crear ${recurrenceDates.length} citas`
                  : "Crear cita"}
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );

  // Celular: bottom-sheet grande, cómodo para el pulgar.
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[94dvh]">
          <DrawerTitle className="sr-only">Nueva cita</DrawerTitle>
          <div
            className="overflow-y-auto px-4 pt-2"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}
          >
            {body}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[85vh] overflow-y-auto sm:max-w-lg",
          // El paso de día y horario respira en desktop
          step === "schedule" && scheduleMode === "slots" && "lg:max-w-3xl"
        )}
      >
        <DialogTitle className="sr-only">Nueva cita</DialogTitle>
        {body}
      </DialogContent>
    </Dialog>
  );
}

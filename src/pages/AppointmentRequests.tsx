import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  X,
  MessageCircle,
  Mail,
  Phone,
  Calendar,
  Video,
  MapPin,
  UserPlus,
  UserCheck,
  Inbox,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  XCircle,
} from "lucide-react";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { useBusinessId } from "@/hooks/use-business-id";
import { PENDING_REQUESTS_COUNT_KEY } from "@/hooks/use-pending-requests-count";
import { ListPagination, usePagination, ITEMS_PER_PAGE } from "@/components/ListPagination";
import { notifyPatient } from "@/lib/push-notifications";
import { cn } from "@/lib/utils";

type PendingItem =
  | {
      kind: "portal_booking";
      key: string;
      datetime: string;
      name: string;
      email: string | null;
      phone: string | null;
      notes: string | null;
      modality: string | null;
      appointmentId: string;
      endAt: string;
      patientId: string | null;
    }
  | {
      kind: "public_request";
      key: string;
      datetime: string;
      name: string;
      email: string;
      phone: string;
      notes: string | null;
      requestId: string;
      raw: any;
    }
  | {
      kind: "reschedule";
      key: string;
      datetime: string; // requested_start_at — used for sort
      requestId: string;
      appointmentId: string;
      patientId: string | null;
      name: string;
      phone: string | null;
      email: string | null;
      avatarUrl: string | null;
      reason: string | null;
      currentStartAt: string;
      currentEndAt: string;
      currentModality: string | null;
      newStartAt: string;
      newEndAt: string;
      newModality: string | null;
    };

type RecentCancellation = {
  id: string;
  patientName: string;
  patientPhone: string | null;
  startAt: string;
  cancelledAt: string;
  reason: string | null;
};

const AppointmentRequests = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancellationsOpen, setCancellationsOpen] = useState(false);

  // Reject reschedule dialog
  const [rejectTarget, setRejectTarget] = useState<Extract<PendingItem, { kind: "reschedule" }> | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Slot unavailable dialog
  const [slotUnavailableTarget, setSlotUnavailableTarget] = useState<
    Extract<PendingItem, { kind: "reschedule" }> | null
  >(null);

  const { businessId, loading: businessLoading } = useBusinessId();

  const { data: publicRequests = [], isLoading: loadingReqs } = useQuery({
    queryKey: ["appointment_requests", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_requests")
        .select("*")
        .eq("business_id", businessId!)
        .eq("status", "pending")
        .order("requested_datetime", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: portalBookings = [], isLoading: loadingPortal } = useQuery({
    queryKey: ["portal_pending_appointments", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, start_at, end_at, modality, notes, patient_id,
          patients ( full_name, email, whatsapp_phone )
        `)
        .eq("business_id", businessId!)
        .eq("status", "pending")
        .eq("source", "patient_portal")
        .order("start_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: rescheduleRequests = [], isLoading: loadingReschedule } = useQuery({
    queryKey: ["reschedule_pending_requests", businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_reschedule_requests")
        .select(`
          id, original_appointment_id, requested_slot_id,
          requested_start_at, requested_end_at, reason, requested_by,
          appointments:original_appointment_id (
            id, start_at, end_at, modality, patient_id,
            patients ( full_name, email, whatsapp_phone, avatar_url )
          ),
          availability_slots:requested_slot_id ( modality )
        `)
        .eq("business_id", businessId!)
        .eq("status", "pending")
        .order("requested_start_at", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const { data: recentCancellations = [], isLoading: loadingCancellations } = useQuery({
    queryKey: ["recent_unack_cancellations", businessId],
    queryFn: async (): Promise<RecentCancellation[]> => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, start_at, cancelled_at, cancellation_reason,
          patients ( full_name, whatsapp_phone )
        `)
        .eq("business_id", businessId!)
        .eq("status", "cancelled_by_patient")
        .is("cancellation_acknowledged_at", null)
        .gte("cancelled_at", sevenDaysAgo.toISOString())
        .order("cancelled_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((a: any) => ({
        id: a.id,
        patientName: a.patients?.full_name ?? "Paciente",
        patientPhone: a.patients?.whatsapp_phone ?? null,
        startAt: a.start_at,
        cancelledAt: a.cancelled_at,
        reason: a.cancellation_reason,
      }));
    },
    enabled: !!businessId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const items: PendingItem[] = [
    ...portalBookings.map((a: any): PendingItem => ({
      kind: "portal_booking",
      key: `apt-${a.id}`,
      datetime: a.start_at,
      endAt: a.end_at,
      name: a.patients?.full_name || "Paciente",
      email: a.patients?.email ?? null,
      phone: a.patients?.whatsapp_phone ?? null,
      notes: a.notes ?? null,
      modality: a.modality ?? null,
      appointmentId: a.id,
      patientId: a.patient_id,
    })),
    ...publicRequests.map((r: any): PendingItem => ({
      kind: "public_request",
      key: `req-${r.id}`,
      datetime: r.requested_datetime,
      name: r.name,
      email: r.email,
      phone: r.phone,
      notes: r.message ?? null,
      requestId: r.id,
      raw: r,
    })),
    ...rescheduleRequests
      .filter((r: any) => r.appointments) // skip if original appointment missing
      .map((r: any): PendingItem => {
        const appt = r.appointments;
        const p = appt?.patients;
        return {
          kind: "reschedule",
          key: `resch-${r.id}`,
          datetime: r.requested_start_at,
          requestId: r.id,
          appointmentId: appt.id,
          patientId: appt.patient_id,
          name: p?.full_name ?? "Paciente",
          phone: p?.whatsapp_phone ?? null,
          email: p?.email ?? null,
          avatarUrl: p?.avatar_url ?? null,
          reason: r.reason,
          currentStartAt: appt.start_at,
          currentEndAt: appt.end_at,
          currentModality: appt.modality,
          newStartAt: r.requested_start_at,
          newEndAt: r.requested_end_at,
          newModality: r.availability_slots?.modality ?? appt.modality,
        };
      }),
  ].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const { paginatedItems: pageItems, totalPages } = usePagination(items, currentPage);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["appointment_requests", businessId] });
    queryClient.invalidateQueries({ queryKey: ["portal_pending_appointments", businessId] });
    queryClient.invalidateQueries({ queryKey: ["reschedule_pending_requests", businessId] });
    queryClient.invalidateQueries({ queryKey: ["recent_unack_cancellations", businessId] });
    queryClient.invalidateQueries({ queryKey: ["appointments", businessId] });
    // Badge del sidebar: se actualiza al instante al resolver una solicitud.
    queryClient.invalidateQueries({ queryKey: [PENDING_REQUESTS_COUNT_KEY, businessId] });
  };

  // Realtime: invalidar las listas cuando cambian las tablas relacionadas
  useEffect(() => {
    if (!businessId) return;

    const channel = supabase
      .channel(`appointment-requests-page-${businessId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_requests", filter: `business_id=eq.${businessId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["appointment_requests", businessId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `business_id=eq.${businessId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["portal_pending_appointments", businessId] });
          queryClient.invalidateQueries({ queryKey: ["recent_unack_cancellations", businessId] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointment_reschedule_requests", filter: `business_id=eq.${businessId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["reschedule_pending_requests", businessId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, queryClient]);

  // ---------- Portal booking actions ----------
  const confirmPortalBooking = async (item: Extract<PendingItem, { kind: "portal_booking" }>) => {
    try {
      setBusyId(item.key);
      const { error } = await supabase
        .from("appointments")
        .update({ status: "scheduled" })
        .eq("id", item.appointmentId);
      if (error) throw error;

      const d = new Date(item.datetime);
      if (item.patientId) {
        notifyPatient({
          patientId: item.patientId,
          title: "¡Tu cita fue confirmada!",
          body: `Tu reserva del ${d.toLocaleDateString("es-UY", { day: "2-digit", month: "long" })} a las ${d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })} fue confirmada.`,
          url: "/portal",
        });
      }

      // Best-effort: mail de confirmación al paciente (además de campana/push)
      if (item.email) {
        try {
          await supabase.functions.invoke("send-resend-email", {
            body: {
              to: item.email,
              template: "appointment_confirmation",
              businessId,
              data: {
                patientName: item.name,
                date: d.toLocaleDateString("es-UY", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }),
                time: d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" }),
                modality: item.modality || "presencial",
                location: null,
              },
            },
          });
        } catch (mailErr) {
          console.warn("Confirmation email failed:", mailErr);
        }
      }

      toast({ title: "Cita confirmada", description: `${item.name} fue notificado.` });
      invalidate();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo confirmar la cita", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const rejectPortalBooking = async (item: Extract<PendingItem, { kind: "portal_booking" }>) => {
    try {
      setBusyId(item.key);
      const { error } = await supabase
        .from("appointments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Rechazada por profesional",
        })
        .eq("id", item.appointmentId);
      if (error) throw error;

      if (item.patientId) {
        notifyPatient({
          patientId: item.patientId,
          title: "Tu reserva fue rechazada",
          body: "Contactá al consultorio para coordinar otro horario.",
          url: "/portal",
        });
      }

      // Best-effort: mail al paciente para que no quede esperando
      if (item.email) {
        try {
          const d = new Date(item.datetime);
          await supabase.functions.invoke("send-resend-email", {
            body: {
              to: item.email,
              template: "raw",
              businessId,
              data: {
                subject: "Sobre tu reserva",
                message:
                  `Hola ${item.name},\n\n` +
                  `Tu reserva del ${d.toLocaleDateString("es-UY", { day: "2-digit", month: "long" })} a las ${d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })} no pudo ser confirmada.\n\n` +
                  `Podés elegir otro horario desde tu portal, o contactar directamente al consultorio.`,
              },
            },
          });
        } catch (mailErr) {
          console.warn("Rejection email failed:", mailErr);
        }
      }

      toast({ title: "Reserva rechazada" });
      invalidate();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo rechazar la cita", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  // ---------- Public request actions ----------
  const acceptPublicRequest = async (item: Extract<PendingItem, { kind: "public_request" }>) => {
    const request = item.raw;
    try {
      setBusyId(item.key);
      if (!businessId) return;

      let patientId: string | null = null;
      const { data: existing } = await supabase
        .from("patients")
        .select("id")
        .eq("business_id", businessId)
        .eq("email", request.email)
        .maybeSingle();

      if (existing) {
        patientId = existing.id;
      } else {
        const { data: { user: creator } } = await supabase.auth.getUser();
        const { data: created, error } = await supabase
          .from("patients")
          .insert({
            business_id: businessId,
            full_name: request.name,
            email: request.email,
            whatsapp_phone: request.phone,
            reason_for_consultation: request.message,
            // Sin esto la ficha queda "huérfana" y el RLS la esconde
            // ("Sin paciente" en la agenda).
            assigned_professional_id: creator?.id ?? null,
            created_by: creator?.id ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        patientId = created.id;
      }

      const endDt = new Date(request.requested_datetime);
      endDt.setHours(endDt.getHours() + 1);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Sesión no válida");

      const { error: aptError } = await supabase.from("appointments").insert({
        business_id: businessId,
        patient_id: patientId,
        professional_id: currentUser.id,
        start_at: request.requested_datetime,
        end_at: endDt.toISOString(),
        contact_name: request.name,
        contact_email: request.email,
        contact_phone: request.phone,
        notes: request.message,
        status: "confirmed",
        source: "web",
      });
      if (aptError) throw aptError;

      await supabase.from("appointment_requests").update({ status: "accepted" }).eq("id", request.id);

      if (patientId) {
        const d = new Date(request.requested_datetime);
        notifyPatient({
          patientId,
          title: "¡Tu cita fue confirmada!",
          body: `Tu solicitud para el ${d.toLocaleDateString("es-UY", { day: "2-digit", month: "long" })} a las ${d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })} fue aceptada.`,
          url: "/portal",
        });
      }

      toast({ title: "Cita creada", description: "Se creó la ficha del paciente y se confirmó la cita." });
      invalidate();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo aceptar la solicitud", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const rejectPublicRequest = async (item: Extract<PendingItem, { kind: "public_request" }>) => {
    try {
      setBusyId(item.key);
      const { error } = await supabase
        .from("appointment_requests")
        .update({ status: "rejected" })
        .eq("id", item.requestId);
      if (error) throw error;
      toast({ title: "Solicitud rechazada" });
      invalidate();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo rechazar la solicitud", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  // ---------- Reschedule actions ----------
  const approveReschedule = async (item: Extract<PendingItem, { kind: "reschedule" }>) => {
    try {
      setBusyId(item.key);
      const { data, error } = await supabase.rpc("approve_reschedule_request", { p_request_id: item.requestId });
      if (error) throw error;

      const result = data as any;
      if (result && result.ok === false) {
        if (result.error === "slot_unavailable") {
          setSlotUnavailableTarget(item);
          return;
        }
        throw new Error(result.message || "No se pudo aprobar");
      }

      const dNew = new Date(item.newStartAt);
      if (item.patientId) {
        notifyPatient({
          patientId: item.patientId,
          title: "Tu reprogramación fue aprobada",
          body: `Tu nuevo horario: ${dNew.toLocaleDateString("es-UY", { day: "2-digit", month: "long" })} a las ${dNew.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}.`,
          url: "/portal",
        });
      }

      // Best-effort: mail con el nuevo horario
      if (item.email) {
        try {
          await supabase.functions.invoke("send-resend-email", {
            body: {
              to: item.email,
              template: "raw",
              businessId,
              data: {
                subject: "Tu reprogramación fue aprobada",
                message:
                  `Hola ${item.name},\n\n` +
                  `Tu cita fue reprogramada. Nuevo horario: ${dNew.toLocaleDateString("es-UY", { weekday: "long", day: "2-digit", month: "long" })} a las ${dNew.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}.\n\n` +
                  `Antes de la sesión te va a llegar el recordatorio de siempre.`,
              },
            },
          });
        } catch (mailErr) {
          console.warn("Reschedule email failed:", mailErr);
        }
      }

      toast({
        title: "Reprogramación aprobada",
        description: `${item.name} fue notificado del nuevo horario.`,
      });
      invalidate();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "No se pudo aprobar la reprogramación", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const confirmRejectReschedule = async () => {
    if (!rejectTarget) return;
    const item = rejectTarget;
    try {
      setBusyId(item.key);
      const { error } = await supabase.rpc("reject_reschedule_request", {
        p_request_id: item.requestId,
        p_rejection_reason: rejectReason.trim() || null,
      });
      if (error) throw error;

      if (item.patientId) {
        notifyPatient({
          patientId: item.patientId,
          title: "Tu reprogramación fue rechazada",
          body: rejectReason.trim()
            ? `Motivo: ${rejectReason.trim()}`
            : "Tu cita original sigue agendada. Contactá al consultorio.",
          url: "/portal",
        });
      }

      // Best-effort: mail para que sepa que su cita original sigue en pie
      if (item.email) {
        try {
          const dOrig = new Date(item.currentStartAt);
          await supabase.functions.invoke("send-resend-email", {
            body: {
              to: item.email,
              template: "raw",
              businessId,
              data: {
                subject: "Sobre tu pedido de reprogramación",
                message:
                  `Hola ${item.name},\n\n` +
                  `No fue posible reprogramar tu cita.` +
                  (rejectReason.trim() ? ` Motivo: ${rejectReason.trim()}.` : "") +
                  `\n\nTu cita original sigue agendada: ${dOrig.toLocaleDateString("es-UY", { weekday: "long", day: "2-digit", month: "long" })} a las ${dOrig.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })}.\n\n` +
                  `Cualquier cosa, contactá al consultorio.`,
              },
            },
          });
        } catch (mailErr) {
          console.warn("Reschedule rejection email failed:", mailErr);
        }
      }

      toast({
        title: "Reprogramación rechazada",
        description: `${item.name} fue notificado.`,
      });
      setRejectTarget(null);
      setRejectReason("");
      invalidate();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Error", description: e.message || "No se pudo rechazar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  // ---------- Cancellation acknowledgement ----------
  const ackCancellation = async (id: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ cancellation_acknowledged_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["recent_unack_cancellations", businessId] });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo marcar como vista", variant: "destructive" });
    }
  };

  const ackAllCancellations = async () => {
    if (!businessId || recentCancellations.length === 0) return;
    try {
      const ids = recentCancellations.map((c) => c.id);
      const { error } = await supabase
        .from("appointments")
        .update({ cancellation_acknowledged_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      toast({ title: "Marcadas como vistas" });
      queryClient.invalidateQueries({ queryKey: ["recent_unack_cancellations", businessId] });
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron marcar", variant: "destructive" });
    }
  };

  const whatsappLink = (phone: string, name: string, dt: string) => {
    const datetime = new Date(dt);
    const message = `Hola ${name}, sobre tu solicitud de cita para ${format(datetime, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}.`;
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  };

  const whatsappLinkReschedule = (phone: string, name: string) => {
    const message = `Hola ${name}, sobre tu solicitud de reprogramación.`;
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  };

  if (!businessId && businessLoading) return <RouteSkeleton />;

  const loading = loadingReqs || loadingPortal || loadingReschedule;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1500px]">
        {/* Encabezado de página */}
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "hsla(38, 92%, 55%, 0.14)" }}>
              <Inbox className="h-5 w-5" style={{ color: "hsl(38 92% 55%)" }} />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Solicitudes</h1>
              <p className="text-sm text-muted-foreground">
                {items.length === 0
                  ? "Nada espera tu respuesta"
                  : `${items.length} pendiente${items.length !== 1 ? "s" : ""} de aprobar`}
              </p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al panel
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Columna principal: pendientes */}
          <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Pendientes de aprobar</CardTitle>
            <CardDescription>
              Reservas, solicitudes públicas y reprogramaciones que esperan tu confirmación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground">Nada pendiente</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cuando un paciente reserve, solicite o pida reprogramar una cita, va a aparecer acá.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pageItems.map((item) => {
                  if (item.kind === "reschedule") {
                    return (
                      <RescheduleCard
                        key={item.key}
                        item={item}
                        busy={busyId === item.key}
                        onApprove={approveReschedule}
                        onReject={(it) => {
                          setRejectTarget(it);
                          setRejectReason("");
                        }}
                        whatsappLink={whatsappLinkReschedule}
                      />
                    );
                  }
                  return (
                    <PendingCard
                      key={item.key}
                      item={item}
                      busy={busyId === item.key}
                      onConfirmPortal={confirmPortalBooking}
                      onRejectPortal={rejectPortalBooking}
                      onAcceptPublic={acceptPublicRequest}
                      onRejectPublic={rejectPublicRequest}
                      whatsappLink={whatsappLink}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={items.length}
          pageSize={ITEMS_PER_PAGE}
        />
          </div>

          {/* Panel lateral: resumen + cancelaciones recientes */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  {
                    label: "Reservas del portal",
                    count: items.filter((i) => i.kind === "portal_booking").length,
                    tint: "176 100% 32%",
                  },
                  {
                    label: "Solicitudes públicas",
                    count: items.filter((i) => i.kind === "public_request").length,
                    tint: "210 90% 60%",
                  },
                  {
                    label: "Reprogramaciones",
                    count: items.filter((i) => i.kind === "reschedule").length,
                    tint: "38 92% 55%",
                  },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3.5 py-2.5"
                  >
                    <span className="text-sm text-muted-foreground inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: `hsl(${row.tint})` }} />
                      {row.label}
                    </span>
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: row.count > 0 ? `hsl(${row.tint})` : undefined }}
                    >
                      {row.count}
                    </span>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Todo al día ✓ — cuando llegue algo nuevo, te avisamos por email y notificación.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Cancelaciones recientes */}
            {!loadingCancellations && recentCancellations.length > 0 && (
              <Collapsible
                open={cancellationsOpen}
                onOpenChange={setCancellationsOpen}
                className="rounded-xl border bg-muted/30"
              >
                <div className="flex items-center justify-between p-3 gap-2">
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-foreground flex-1 min-w-0 hover:opacity-80">
                    <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="truncate">
                      Cancelaciones recientes ({recentCancellations.length})
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        cancellationsOpen && "rotate-180"
                      )}
                    />
                  </CollapsibleTrigger>
                  {recentCancellations.length >= 2 && (
                    <Button variant="ghost" size="sm" onClick={ackAllCancellations} className="text-xs h-7">
                      Marcar todas como vistas
                    </Button>
                  )}
                </div>
                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-1.5">
                    {recentCancellations.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{c.patientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Canceló cita del {format(new Date(c.startAt), "d 'de' MMM HH:mm", { locale: es })}
                            {c.reason && ` · "${c.reason}"`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs shrink-0"
                          onClick={() => ackCancellation(c.id)}
                        >
                          Marcar como vista
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Cómo funciona */}
            <Card className="border-dashed">
              <CardContent className="p-4 text-xs text-muted-foreground leading-relaxed">
                Al <span className="font-medium text-foreground">confirmar</span>, la cita entra a tu
                agenda y el paciente recibe el aviso automáticamente. Al{" "}
                <span className="font-medium text-foreground">rechazar</span>, también se le avisa —
                nunca queda esperando sin respuesta.
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Reject reschedule dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar reprogramación</DialogTitle>
            <DialogDescription>
              {rejectTarget && `La cita de ${rejectTarget.name} sigue agendada en su horario original.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo (opcional) — el paciente lo verá en la notificación"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRejectReschedule}
              disabled={!!busyId}
            >
              Rechazar reprogramación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot unavailable dialog */}
      <Dialog open={!!slotUnavailableTarget} onOpenChange={(o) => { if (!o) setSlotUnavailableTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Horario no disponible</DialogTitle>
            <DialogDescription>
              Este horario ya no está disponible. Contactá al paciente para acordar otro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotUnavailableTarget(null)}>
              Cerrar
            </Button>
            {slotUnavailableTarget?.phone && (
              <Button
                onClick={() => {
                  window.open(
                    whatsappLinkReschedule(slotUnavailableTarget.phone!, slotUnavailableTarget.name),
                    "_blank"
                  );
                  setSlotUnavailableTarget(null);
                }}
                className="gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                Contactar por WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------- Reschedule card ----------
interface RescheduleCardProps {
  item: Extract<PendingItem, { kind: "reschedule" }>;
  busy: boolean;
  onApprove: (i: Extract<PendingItem, { kind: "reschedule" }>) => void;
  onReject: (i: Extract<PendingItem, { kind: "reschedule" }>) => void;
  whatsappLink: (phone: string, name: string) => string;
}

const ModalityChip = ({ modality }: { modality: string | null }) => {
  if (!modality) return null;
  const isOnline = modality === "online" || modality.toLowerCase() === "online";
  return (
    <Badge variant="secondary" className="rounded-full text-[10px] gap-1 px-2 py-0">
      {isOnline ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
      {isOnline ? "Online" : "Presencial"}
    </Badge>
  );
};

const RescheduleCard = ({ item, busy, onApprove, onReject, whatsappLink }: RescheduleCardProps) => {
  const current = new Date(item.currentStartAt);
  const next = new Date(item.newStartAt);
  const initials = item.name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="rounded-xl border bg-card p-4 border-l-4 border-l-amber-500 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="h-10 w-10 shrink-0">
          {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.name} />}
          <AvatarFallback>{initials || "P"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className="rounded-full text-[10px] gap-1 px-2 py-0 border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5"
            >
              <RefreshCw className="h-3 w-3" />
              Reprogramación
            </Badge>
          </div>
          <p className="font-semibold text-foreground truncate">{item.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-3 sm:gap-2 items-stretch mb-3">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
            Cita actual
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {format(current, "EEE d 'de' MMM, HH:mm", { locale: es })}
          </p>
          <div className="mt-1.5">
            <ModalityChip modality={item.currentModality} />
          </div>
        </div>
        <div className="flex sm:flex-col items-center justify-center text-muted-foreground">
          <ArrowRight className="h-4 w-4 sm:hidden" />
          <ArrowRight className="h-4 w-4 hidden sm:block" />
        </div>
        <div className="rounded-lg border bg-primary/5 border-primary/20 p-3">
          <p className="text-[10px] uppercase tracking-wide text-primary font-medium mb-1">
            Nuevo horario solicitado
          </p>
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
            {format(next, "EEE d 'de' MMM, HH:mm", { locale: es })}
          </p>
          <div className="mt-1.5">
            <ModalityChip modality={item.newModality} />
          </div>
        </div>
      </div>

      {item.reason && (
        <p className="text-sm bg-muted/40 rounded-lg p-2.5 mb-3 text-foreground/80">
          <span className="text-xs text-muted-foreground">Motivo del paciente: </span>
          {item.reason}
        </p>
      )}

      <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 sm:justify-end">
        {item.phone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(whatsappLink(item.phone!, item.name), "_blank")}
            className="gap-1.5 w-full sm:w-auto"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => onReject(item)}
          className="gap-1.5 text-destructive hover:text-destructive w-full sm:w-auto"
        >
          <X className="h-4 w-4" />
          Rechazar
        </Button>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onApprove(item)}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
        >
          <Check className="h-4 w-4" />
          Aprobar
        </Button>
      </div>
    </div>
  );
};

interface PendingCardProps {
  item: Exclude<PendingItem, { kind: "reschedule" }>;
  busy: boolean;
  onConfirmPortal: (i: Extract<PendingItem, { kind: "portal_booking" }>) => void;
  onRejectPortal: (i: Extract<PendingItem, { kind: "portal_booking" }>) => void;
  onAcceptPublic: (i: Extract<PendingItem, { kind: "public_request" }>) => void;
  onRejectPublic: (i: Extract<PendingItem, { kind: "public_request" }>) => void;
  whatsappLink: (phone: string, name: string, dt: string) => string;
}

const PendingCard = ({
  item,
  busy,
  onConfirmPortal,
  onRejectPortal,
  onAcceptPublic,
  onRejectPublic,
  whatsappLink,
}: PendingCardProps) => {
  const isPortal = item.kind === "portal_booking";
  const dt = new Date(item.datetime);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 border-l-4 transition-shadow hover:shadow-md",
        isPortal ? "border-l-primary" : "border-l-violet-500"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "rounded-full text-[10px] gap-1 px-2 py-0",
                isPortal
                  ? "border-primary/30 text-primary bg-primary/5"
                  : "border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/5"
              )}
            >
              {isPortal ? <UserCheck className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
              {isPortal ? "Paciente registrado" : "Primera consulta"}
            </Badge>
            {isPortal && item.modality && (
              <Badge variant="secondary" className="rounded-full text-[10px] gap-1 px-2 py-0">
                {item.modality === "online" ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                {item.modality === "online" ? "Online" : "Presencial"}
              </Badge>
            )}
          </div>
          <p className="font-semibold text-foreground truncate">{item.name}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {format(dt, "EEEE d 'de' MMMM, HH:mm", { locale: es })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 text-sm text-muted-foreground mb-3">
        {item.email && (
          <span className="flex items-center gap-1.5 truncate">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.email}</span>
          </span>
        )}
        {item.phone && (
          <span className="flex items-center gap-1.5 truncate">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.phone}</span>
          </span>
        )}
      </div>

      {item.notes && (
        <p className="text-sm bg-muted/40 rounded-lg p-2.5 mb-3 text-foreground/80">
          {item.notes}
        </p>
      )}

      <div className="flex flex-wrap gap-2 justify-end">
        {item.phone && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(whatsappLink(item.phone!, item.name, item.datetime), "_blank")}
            className="gap-1.5"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        )}
        {isPortal ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onRejectPortal(item)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Rechazar
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onConfirmPortal(item)} className="gap-1.5">
              <Check className="h-4 w-4" />
              Confirmar
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onRejectPublic(item)}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Rechazar
            </Button>
            <Button size="sm" disabled={busy} onClick={() => onAcceptPublic(item)} className="gap-1.5">
              <Check className="h-4 w-4" />
              Aceptar
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AppointmentRequests;

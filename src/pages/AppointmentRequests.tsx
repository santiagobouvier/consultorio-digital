import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Check, X, MessageCircle, Mail, Phone, Calendar, Video, MapPin, UserPlus, UserCheck, Inbox } from "lucide-react";
import { RouteSkeleton } from "@/components/RouteSkeleton";
import { useBusinessId } from "@/hooks/use-business-id";
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
    };

const AppointmentRequests = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

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
  ].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const { paginatedItems: pageItems, totalPages } = usePagination(items, currentPage);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["appointment_requests", businessId] });
    queryClient.invalidateQueries({ queryKey: ["portal_pending_appointments", businessId] });
    queryClient.invalidateQueries({ queryKey: ["appointments", businessId] });
  };

  // ---------- Portal booking actions ----------
  const confirmPortalBooking = async (item: Extract<PendingItem, { kind: "portal_booking" }>) => {
    try {
      setBusyId(item.key);
      const { error } = await supabase
        .from("appointments")
        .update({ status: "scheduled" })
        .eq("id", item.appointmentId);
      if (error) throw error;

      if (item.patientId) {
        const d = new Date(item.datetime);
        notifyPatient({
          patientId: item.patientId,
          title: "¡Tu cita fue confirmada!",
          body: `Tu reserva del ${d.toLocaleDateString("es-UY", { day: "2-digit", month: "long" })} a las ${d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" })} fue confirmada.`,
          url: "/portal",
        });
      }

      toast({
        title: "Cita confirmada",
        description: `${item.name} fue notificado.`,
      });
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
        const { data: created, error } = await supabase
          .from("patients")
          .insert({
            business_id: businessId,
            full_name: request.name,
            email: request.email,
            whatsapp_phone: request.phone,
            reason_for_consultation: request.message,
          })
          .select()
          .single();
        if (error) throw error;
        patientId = created.id;
      }

      const endDt = new Date(request.requested_datetime);
      endDt.setHours(endDt.getHours() + 1);

      const { error: aptError } = await supabase.from("appointments").insert({
        business_id: businessId,
        patient_id: patientId,
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

  const whatsappLink = (phone: string, name: string, dt: string) => {
    const datetime = new Date(dt);
    const message = `Hola ${name}, sobre tu solicitud de cita para ${format(datetime, "dd/MM/yyyy 'a las' HH:mm", { locale: es })}.`;
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  };

  if (!businessId && businessLoading) return <RouteSkeleton />;

  const loading = loadingReqs || loadingPortal;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al panel
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pendientes de aprobar</CardTitle>
            <CardDescription>
              Reservas hechas desde el portal y solicitudes públicas que esperan tu confirmación.
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
                  Cuando un paciente reserve o solicite una cita, va a aparecer acá.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pageItems.map((item) => (
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
                ))}
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
    </div>
  );
};

interface PendingCardProps {
  item: PendingItem;
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
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, Stethoscope, Video } from "lucide-react";
import LoadingPage from "@/components/LoadingPage";
import { toast } from "sonner";
import NotFound from "./NotFound";
import { getPlanDefinition } from "@/lib/plan-definitions";

type Slot = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  modality: string;
  price: number | null;
};

const formSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre completo").max(100),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().min(6, "Teléfono inválido").max(30),
  message: z.string().trim().max(500).optional(),
});

const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formatSlotDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} de ${MONTH_NAMES[m - 1]}`;
};

const formatTime = (t: string) => t.slice(0, 5);

const PublicBooking = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<any>(null);
  const [planAllowsPublicWeb, setPlanAllowsPublicWeb] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        if (!slug) {
          if (!cancelled) setLoading(false);
          return;
        }

        const columns =
          "id, name, specialty, public_slug, custom_subdomain, portal_logo_url, portal_primary_color, portal_dark_primary_color, portal_clinic_display_name, plan_code";

        let businessData: any = null;
        const bySlug = await supabase
          .from("businesses")
          .select(columns)
          .eq("public_slug", slug)
          .maybeSingle();
        if (bySlug.error) throw bySlug.error;
        businessData = bySlug.data;

        if (!businessData) {
          const bySubdomain = await supabase
            .from("businesses")
            .select(columns)
            .eq("custom_subdomain", slug)
            .maybeSingle();
          if (bySubdomain.error) throw bySubdomain.error;
          businessData = bySubdomain.data;
        }

        if (!businessData) {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        // Restricción por plan: la reserva pública solo está disponible
        // en planes con `hasPublicWeb`.
        const planDef = getPlanDefinition(businessData.plan_code);
        if (!planDef.hasPublicWeb) {
          if (!cancelled) {
            setPlanAllowsPublicWeb(false);
            setLoading(false);
          }
          return;
        }

        // Slots disponibles próximos (próximos 60 días, máx 50)
        const today = new Date().toISOString().slice(0, 10);
        const future = new Date();
        future.setDate(future.getDate() + 60);
        const futureStr = future.toISOString().slice(0, 10);

        const { data: slotsData, error: slotsError } = await supabase
          .from("availability_slots")
          .select("id, date, start_time, end_time, modality, price")
          .eq("business_id", businessData.id)
          .eq("status", "available")
          .gte("date", today)
          .lte("date", futureStr)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(50);

        if (slotsError) throw slotsError;

        if (cancelled) return;
        setBusiness(businessData);
        setSlots((slotsData ?? []) as Slot[]);
      } catch (error) {
        console.error("[PublicBooking] Error cargando reserva:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const accent = useMemo(() => {
    const light = business?.portal_primary_color || "176 100% 32%";
    const dark = business?.portal_dark_primary_color || "176 85% 42%";
    return { light, dark };
  }, [business]);

  const brandStyle = useMemo(
    () =>
      ({
        ["--brand" as any]: accent.light,
        ["--brand-dark" as any]: accent.dark,
      }) as React.CSSProperties,
    [accent]
  );

  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [slots]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !slug) return;

    const parsed = formSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      setSubmitting(true);
      const { data, error } = await supabase.functions.invoke(
        "public-create-appointment-request",
        {
          body: {
            slug,
            slotId: selectedSlot.id,
            name: parsed.data.name,
            email: parsed.data.email,
            phone: parsed.data.phone,
            message: parsed.data.message ?? "",
          },
        }
      );

      if (error || (data && (data as any).error)) {
        const errCode = (data as any)?.error || error?.message;
        if (errCode === "slot_not_available") {
          toast.error("Ese horario ya no está disponible. Elegí otro.");
          // refrescar slots
          setSelectedSlot(null);
          setSlots((prev) => prev.filter((s) => s.id !== selectedSlot.id));
        } else {
          toast.error("No pudimos confirmar tu reserva. Intentá de nuevo.");
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("[PublicBooking] submit error", err);
      toast.error("No pudimos confirmar tu reserva. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingPage />;

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <p className="font-semibold text-foreground">Este consultorio no está disponible</p>
            <p className="text-sm text-muted-foreground">
              Verificá el link que te compartieron.
            </p>
            <Button variant="outline" onClick={() => navigate("/")} className="gap-2 mt-4">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clinicName =
    business.portal_clinic_display_name || business.name || "Consultorio";
  const targetSlug = business.public_slug || slug;

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background p-4"
        style={brandStyle}
      >
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div
              className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
              style={{ background: `hsl(var(--brand) / 0.15)` }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: `hsl(var(--brand))` }} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">¡Reserva confirmada!</h1>
              <p className="text-sm text-muted-foreground">
                Te enviamos los detalles a tu email. El consultorio se pondrá en contacto si necesita algo más.
              </p>
            </div>
            {selectedSlot && (
              <div className="bg-muted/40 border border-border rounded-lg p-3 text-sm">
                <p className="font-semibold text-foreground">
                  {formatSlotDate(selectedSlot.date)}
                </p>
                <p className="text-muted-foreground">
                  {formatTime(selectedSlot.start_time)} – {formatTime(selectedSlot.end_time)}
                </p>
              </div>
            )}
            <Button
              className="w-full gap-2"
              style={{ background: `hsl(var(--brand))`, color: "white" }}
              onClick={() => navigate(`/consultorio/${targetSlug}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al consultorio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground" style={brandStyle}>
      {/* Header */}
      <header className="border-b border-border bg-card/40">
        <div className="container mx-auto max-w-4xl px-4 py-4 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(`/consultorio/${targetSlug}`)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {business.portal_logo_url ? (
              <img
                src={business.portal_logo_url}
                alt={clinicName}
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `hsl(var(--brand) / 0.15)` }}
              >
                <Stethoscope className="h-4 w-4" style={{ color: `hsl(var(--brand))` }} />
              </div>
            )}
            <span className="font-semibold text-sm sm:text-base truncate">{clinicName}</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
            Reservá tu turno
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Elegí un horario disponible y completá tus datos. No necesitás crear una cuenta.
          </p>
        </div>

        {/* Paso 1: elegir slot */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
              style={{ background: `hsl(var(--brand))`, color: "white" }}
            >
              1
            </div>
            <h2 className="text-lg sm:text-xl font-semibold">Elegí un horario</h2>
          </div>

          {slots.length === 0 ? (
            <Card>
              <CardContent className="pt-6 pb-6 text-center space-y-2">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-medium text-foreground">No hay horarios disponibles por ahora</p>
                <p className="text-sm text-muted-foreground">
                  Te recomendamos volver más tarde o contactar directamente al consultorio.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {slotsByDate.map(({ date, items }) => (
                <Card key={date}>
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <CalendarDays
                        className="h-4 w-4"
                        style={{ color: `hsl(var(--brand))` }}
                      />
                      <h3 className="text-sm sm:text-base font-semibold capitalize">
                        {formatSlotDate(date)}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {items.map((slot) => {
                        const isSelected = selectedSlot?.id === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className="px-3 py-2 rounded-md border-2 text-sm font-medium transition-all flex items-center gap-2"
                            style={
                              isSelected
                                ? {
                                    background: `hsl(var(--brand))`,
                                    borderColor: `hsl(var(--brand))`,
                                    color: "white",
                                  }
                                : {
                                    borderColor: `hsl(var(--brand) / 0.3)`,
                                    color: `hsl(var(--brand))`,
                                    background: `hsl(var(--brand) / 0.06)`,
                                  }
                            }
                          >
                            <span>
                              {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                            </span>
                            {slot.modality?.toLowerCase() === "online" && (
                              <Video className="h-3.5 w-3.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Paso 2: datos de contacto */}
        {slots.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={
                  selectedSlot
                    ? { background: `hsl(var(--brand))`, color: "white" }
                    : { background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
                }
              >
                2
              </div>
              <h2 className="text-lg sm:text-xl font-semibold">Tus datos</h2>
            </div>

            <Card>
              <CardContent className="p-4 sm:p-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Nombre completo *</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Ej: María González"
                        disabled={!selectedSlot || submitting}
                        maxLength={100}
                      />
                      {errors.name && (
                        <p className="text-xs text-destructive">{errors.name}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Teléfono *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="099 123 456"
                        disabled={!selectedSlot || submitting}
                        maxLength={30}
                      />
                      {errors.phone && (
                        <p className="text-xs text-destructive">{errors.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="tu@email.com"
                      disabled={!selectedSlot || submitting}
                      maxLength={255}
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="message">Motivo de la consulta (opcional)</Label>
                    <Textarea
                      id="message"
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                      placeholder="Contanos brevemente qué te gustaría tratar."
                      rows={3}
                      disabled={!selectedSlot || submitting}
                      maxLength={500}
                    />
                  </div>

                  {selectedSlot && (
                    <div
                      className="rounded-lg p-3 text-sm flex items-center gap-2"
                      style={{
                        background: `hsl(var(--brand) / 0.08)`,
                        color: `hsl(var(--brand))`,
                      }}
                    >
                      <CalendarDays className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium capitalize">
                        {formatSlotDate(selectedSlot.date)} · {formatTime(selectedSlot.start_time)}
                      </span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    disabled={!selectedSlot || submitting}
                    className="w-full gap-2 font-semibold"
                    style={{
                      background: selectedSlot ? `hsl(var(--brand))` : undefined,
                      color: selectedSlot ? "white" : undefined,
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {selectedSlot ? "Confirmar reserva" : "Elegí un horario primero"}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </main>
    </div>
  );
};

export default PublicBooking;

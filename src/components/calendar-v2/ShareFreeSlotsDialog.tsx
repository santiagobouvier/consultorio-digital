// "Compartir mis huecos libres": arma solo el mensaje con los próximos
// horarios disponibles (los mismos que ve un paciente al reservar) listo
// para pegar en WhatsApp. La tarea que todos hacen a mano mirando la agenda.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Check, Loader2, MessageCircle, CalendarX2 } from "lucide-react";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
}

interface ShareFreeSlotsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string | null;
  currentUserId: string | null;
}

const DAYS_OPTIONS = [
  { value: "7", label: "Próximos 7 días" },
  { value: "14", label: "Próximos 14 días" },
];

export const ShareFreeSlotsDialog = ({
  open,
  onOpenChange,
  businessId,
  currentUserId,
}: ShareFreeSlotsDialogProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [days, setDays] = useState("7");
  const [slug, setSlug] = useState<string | null>(null);
  const [starts, setStarts] = useState<{ day: string; start_time: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  // Servicios activos + slug público (una vez por apertura)
  useEffect(() => {
    if (!open || !businessId) return;
    (async () => {
      const [{ data: svcs }, { data: biz }] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, duration_minutes")
          .eq("business_id", businessId)
          .eq("is_active", true)
          .order("duration_minutes", { ascending: true }),
        supabase.from("businesses").select("public_slug").eq("id", businessId).maybeSingle(),
      ]);
      setServices((svcs as Service[]) || []);
      setSlug((biz as any)?.public_slug ?? null);
      if (svcs?.length && !svcs.some((s: any) => s.id === serviceId)) {
        setServiceId(svcs[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId]);

  // Huecos reales (mismos que la reserva pública: respeta anticipación mínima)
  useEffect(() => {
    if (!open || !businessId || !serviceId) return;
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;
    setLoading(true);
    (async () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + parseInt(days));
      const { data, error } = await (supabase as any).rpc("get_available_starts", {
        p_business_id: businessId,
        p_professional_user_id: currentUserId,
        p_duration_minutes: service.duration_minutes,
        p_from: format(from, "yyyy-MM-dd"),
        p_to: format(to, "yyyy-MM-dd"),
        p_public: true,
      });
      if (error) {
        console.error(error);
        toast({ title: "Error", description: "No se pudieron cargar los horarios", variant: "destructive" });
        setStarts([]);
      } else {
        setStarts(data || []);
      }
      setLoading(false);
    })();
  }, [open, businessId, serviceId, days, services, currentUserId]);

  // Mensaje armado: hasta 3 horarios por día, hasta 6 días
  const builtText = useMemo(() => {
    if (starts.length === 0) return "";
    const byDay = new Map<string, string[]>();
    for (const s of starts) {
      const arr = byDay.get(s.day) ?? [];
      if (arr.length < 3) arr.push(s.start_time.slice(0, 5));
      byDay.set(s.day, arr);
    }
    const dayLines = [...byDay.entries()].slice(0, 6).map(([day, times]) => {
      const label = format(new Date(`${day}T12:00:00`), "EEEE d/M", { locale: es });
      return `• ${label.charAt(0).toUpperCase() + label.slice(1)} → ${times.join(" o ")}`;
    });
    const serviceName = services.find((s) => s.id === serviceId)?.name;
    const link = slug ? `${window.location.origin}/consultorio/${slug}/reservar` : "";
    return (
      `Hola 👋 Estos son mis próximos horarios libres${serviceName ? ` para ${serviceName}` : ""}:\n\n` +
      dayLines.join("\n") +
      (link ? `\n\nReservá directo desde acá 👇\n${link}` : "")
    );
  }, [starts, services, serviceId, slug]);

  useEffect(() => {
    setText(builtText);
  }, [builtText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copiado", description: "Pegalo en cualquier chat." });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const handleWhatsApp = () => {
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Compartir mis huecos libres</DialogTitle>
          <DialogDescription>
            El mensaje se arma solo con tus horarios reales. Editalo si querés y mandalo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de sesión</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} · {s.duration_minutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rango</Label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Buscando tus huecos...
            </div>
          ) : starts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CalendarX2 className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No hay horarios libres en ese rango.
                <br />
                Probá con más días o revisá tus horarios de atención.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea
                  rows={9}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="text-[13px] leading-relaxed"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Copy className="h-4 w-4 mr-2" />}
                  Copiar
                </Button>
                <Button className="flex-1 bg-[#25D366] hover:bg-[#1fb958] text-white" onClick={handleWhatsApp}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Mandar por WhatsApp
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

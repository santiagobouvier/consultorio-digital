import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Copy, MessageCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  businessId: string;
  onAllDone?: () => void;
}

interface ChecklistState {
  template: boolean;
  slots: boolean;
  mp: boolean;
  shared: boolean;
  slug: string | null;
  loading: boolean;
}

const initial: ChecklistState = {
  template: false,
  slots: false,
  mp: false,
  shared: false,
  slug: null,
  loading: true,
};

export const ActivationChecklist = ({ businessId, onAllDone }: Props) => {
  const navigate = useNavigate();
  const [state, setState] = useState<ChecklistState>(initial);
  const [sharing, setSharing] = useState(false);

  const fetchState = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [tpl, slots, pol, biz] = await Promise.all([
      supabase
        .from("availability_templates")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_active", true),
      supabase
        .from("availability_slots")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .gte("date", today),
      supabase
        .from("payment_policies")
        .select("mp_access_token")
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("public_slug, onboarding_link_shared_at")
        .eq("id", businessId)
        .maybeSingle(),
    ]);
    setState({
      template: (tpl.count ?? 0) > 0,
      slots: (slots.count ?? 0) > 0,
      mp: !!pol.data?.mp_access_token,
      shared: !!biz.data?.onboarding_link_shared_at,
      slug: biz.data?.public_slug ?? null,
      loading: false,
    });
  }, [businessId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const allDone =
    !state.loading && state.template && state.slots && state.mp && state.shared;

  useEffect(() => {
    if (allDone) onAllDone?.();
  }, [allDone, onAllDone]);

  if (state.loading || allDone) return null;

  const publicUrl = state.slug
    ? `${window.location.origin}/consultorio/${state.slug}`
    : null;

  const markShared = async () => {
    const { error } = await supabase
      .from("businesses")
      .update({ onboarding_link_shared_at: new Date().toISOString() })
      .eq("id", businessId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return false;
    }
    setState((s) => ({ ...s, shared: true }));
    return true;
  };

  const handleCopy = async () => {
    if (!publicUrl) {
      toast({ title: "Falta configurar el link público", variant: "destructive" });
      return;
    }
    setSharing(true);
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado" });
      await markShared();
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const handleWhatsapp = async () => {
    if (!publicUrl) {
      toast({ title: "Falta configurar el link público", variant: "destructive" });
      return;
    }
    setSharing(true);
    try {
      const text = encodeURIComponent(
        `Hola, ya podés reservar tu consulta acá: ${publicUrl}`,
      );
      window.open(`https://wa.me/?text=${text}`, "_blank");
      await markShared();
    } finally {
      setSharing(false);
    }
  };

  const items = [
    {
      key: "template",
      done: state.template,
      title: "Definí tu semana tipo",
      desc: "Marcá los días y horarios en que atendés.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/horarios-disponibles")}>
          Configurar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "slots",
      done: state.slots,
      title: "Generá tus horarios del mes",
      desc: "Creá los turnos disponibles para que los pacientes puedan reservar.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/horarios-disponibles")}>
          Generar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "mp",
      done: state.mp,
      title: "Conectá Mercado Pago",
      desc: "Para cobrar reservas online.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/mi-consultorio?tab=pagos")}>
          Conectar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "shared",
      done: state.shared,
      title: "Compartí tu link público",
      desc: "Empezá a recibir reservas.",
      action: (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={sharing || !publicUrl} onClick={handleCopy}>
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Copiar</span>
          </Button>
          <Button size="sm" variant="outline" disabled={sharing || !publicUrl} onClick={handleWhatsapp}>
            <MessageCircle className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">WhatsApp</span>
          </Button>
        </div>
      ),
    },
  ];

  const doneCount = items.filter((i) => i.done).length;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Activá tu consultorio</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Configurá → Reservá → Cobrá → Fidelizá
            </p>
          </div>
          <span className="text-sm font-medium text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center gap-3 rounded-md border border-border/50 bg-card px-3 py-2"
            >
              {it.done ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    it.done ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {it.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">{it.desc}</p>
              </div>
              {!it.done && it.action}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default ActivationChecklist;
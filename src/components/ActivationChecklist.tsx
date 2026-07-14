import { buildShareUrl } from "@/config/app";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Copy, MessageCircle, Loader2, ChevronDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Props {
  businessId: string;
  onAllDone?: () => void;
}

interface ChecklistState {
  contact: boolean;
  template: boolean;
  services: boolean;
  mp: boolean;
  shared: boolean;
  // "Para dejarlo perfecto" (opcionales, no bloquean la activación)
  portalCustomized: boolean;
  invited: boolean;
  push: boolean;
  slug: string | null;
  loading: boolean;
}

const initial: ChecklistState = {
  contact: false,
  template: false,
  services: false,
  mp: false,
  shared: false,
  portalCustomized: false,
  invited: false,
  push: false,
  slug: null,
  loading: true,
};

const DEFAULT_PORTAL_COLOR = "176 100% 32%";
const extrasHiddenKey = (businessId: string) => `activation_extras_hidden_${businessId}`;
const collapsedKey = (businessId: string) => `activation_checklist_collapsed_${businessId}`;

export const ActivationChecklist = ({ businessId, onAllDone }: Props) => {
  const navigate = useNavigate();
  const [state, setState] = useState<ChecklistState>(initial);
  const [sharing, setSharing] = useState(false);
  const [extrasHidden, setExtrasHidden] = useState(() => {
    try {
      return localStorage.getItem(extrasHiddenKey(businessId)) === "1";
    } catch {
      return false;
    }
  });
  // Acordeón: la guía se puede achicar a una barrita con el progreso
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(collapsedKey(businessId)) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(collapsedKey(businessId), c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  const fetchState = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    // Push por separado: mezclarla en el Promise.all hace explotar la
    // inferencia de tipos de supabase-js (TS2589).
    let pushCount = 0;
    if (user) {
      const { count } = await (supabase as any)
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      pushCount = count ?? 0;
    }
    const [tpl, svcs, pol, biz, invites, portalPatients] = await Promise.all([
      supabase
        .from("availability_templates")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_active", true),
      supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_active", true),
      supabase
        .from("payment_policies")
        .select("mp_access_token")
        .eq("business_id", businessId)
        .maybeSingle(),
      supabase
        .from("businesses")
        .select("public_slug, onboarding_link_shared_at, contact_email, portal_logo_url, portal_primary_color")
        .eq("id", businessId)
        .maybeSingle(),
      (supabase as any)
        .from("patient_portal_invites")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("business_id", businessId)
        .not("auth_user_id", "is", null),
    ]);
    const bizData = biz.data as any;
    setState({
      // El email de contacto es adonde llegan los avisos de reservas:
      // sin él, el profesional no se entera de nada.
      contact: !!bizData?.contact_email?.trim(),
      template: (tpl.count ?? 0) > 0,
      services: (svcs.count ?? 0) > 0,
      mp: !!pol.data?.mp_access_token,
      shared: !!bizData?.onboarding_link_shared_at,
      portalCustomized:
        !!bizData?.portal_logo_url ||
        (!!bizData?.portal_primary_color && bizData.portal_primary_color !== DEFAULT_PORTAL_COLOR),
      invited: (invites.count ?? 0) > 0 || (portalPatients.count ?? 0) > 0,
      push: pushCount > 0,
      slug: bizData?.public_slug ?? null,
      loading: false,
    });
  }, [businessId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const essentialsDone =
    !state.loading && state.contact && state.template && state.services && state.mp && state.shared;
  const extrasDone = state.portalCustomized && state.invited && state.push;

  useEffect(() => {
    if (essentialsDone) onAllDone?.();
  }, [essentialsDone, onAllDone]);

  const hideExtras = () => {
    setExtrasHidden(true);
    try {
      localStorage.setItem(extrasHiddenKey(businessId), "1");
    } catch {
      /* ignore */
    }
  };

  if (state.loading) return null;
  if (essentialsDone && (extrasDone || extrasHidden)) return null;

  const publicUrl = state.slug
    ? buildShareUrl(`/consultorio/${state.slug}`)
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
      key: "contact",
      done: state.contact,
      title: "Completá los datos del consultorio",
      desc: "El email de contacto es adonde te llegan los avisos de cada reserva.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/mi-consultorio")}>
          Completar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "services",
      done: state.services,
      title: "Creá tus tipos de sesión",
      desc: "Nombre, duración y precio de lo que ofrecés (ej: Sesión individual, 60 min).",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/horarios-disponibles")}>
          Configurar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "template",
      done: state.template,
      title: "Definí tu semana tipo",
      desc: "Marcá tus días y horarios; la disponibilidad se calcula sola.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/horarios-disponibles")}>
          Configurar <ArrowRight className="h-4 w-4 ml-1" />
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

  // "Para dejarlo perfecto": opcionales que completan consultorio + portal
  const extraItems = [
    {
      key: "portal",
      done: state.portalCustomized,
      title: "Personalizá tu portal",
      desc: "Subí tu logo y elegí tus colores: tu marca en la web y el portal.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/personalizar-portal")}>
          Personalizar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "invited",
      done: state.invited,
      title: "Invitá a tu primer paciente al portal",
      desc: "Desde su ficha: va a poder ver sus citas, pagar y reservar solo.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/patients")}>
          Ir a pacientes <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "push",
      done: state.push,
      title: "Activá las notificaciones",
      desc: "Enterate al instante de cada reserva, incluso con la app cerrada.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/mi-consultorio?tab=notificaciones")}>
          Activar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  const extrasDoneCount = extraItems.filter((i) => i.done).length;

  const renderItem = (it: (typeof items)[number]) => (
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
  );

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-4 sm:p-5 space-y-3">
        {/* Cabecera: siempre visible, toca para expandir/achicar */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ListChecks className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold truncate">
                {essentialsDone ? "Para dejarlo perfecto" : "Activá tu consultorio"}
              </h2>
              {!collapsed && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {essentialsDone
                    ? "Lo esencial ya está ✓ — estos toques completan tu consultorio."
                    : "Configurá → Reservá → Cobrá → Fidelizá"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-muted-foreground">
              {essentialsDone
                ? `${extrasDoneCount}/${extraItems.length}`
                : `${doneCount}/${items.length}`}
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                !collapsed && "rotate-180"
              )}
            />
          </div>
        </button>

        {!collapsed && (
          <>
            {!essentialsDone && <ul className="space-y-2">{items.map(renderItem)}</ul>}

            {!essentialsDone && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
                Para dejarlo perfecto (opcional) · {extrasDoneCount}/{extraItems.length}
              </p>
            )}
            <ul className="space-y-2">{extraItems.map(renderItem)}</ul>

            {essentialsDone && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={hideExtras} className="text-xs text-muted-foreground h-7">
                  Ocultar guía
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivationChecklist;
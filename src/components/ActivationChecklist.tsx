import { buildShareUrl } from "@/config/app";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Copy, MessageCircle, Loader2, ChevronDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useUiPref } from "@/hooks/use-ui-pref";

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

export const ActivationChecklist = ({ businessId, onAllDone }: Props) => {
  const navigate = useNavigate();
  const [state, setState] = useState<ChecklistState>(initial);
  const [sharing, setSharing] = useState(false);
  // Preferencias guardadas en la cuenta del usuario (no se pierden al
  // cambiar de dispositivo ni al limpiar el navegador)
  const [extrasHidden, setExtrasHidden] = useUiPref(`activation_extras_hidden_${businessId}`);
  // Acordeón: la guía se puede achicar a una barrita con el progreso
  const [collapsed, setCollapsed] = useUiPref(`activation_checklist_collapsed_${businessId}`);

  const toggleCollapsed = () => setCollapsed(!collapsed);

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

  const hideExtras = () => setExtrasHidden(true);

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
      to: "/mi-consultorio",
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
      to: "/agenda",
      title: "Creá tus tipos de sesión",
      desc: "Nombre, duración y precio de lo que ofrecés (ej: Sesión individual, 60 min).",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/agenda")}>
          Configurar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "template",
      done: state.template,
      to: "/agenda",
      title: "Definí tu semana tipo",
      desc: "Marcá tus días y horarios; la disponibilidad se calcula sola.",
      action: (
        <Button size="sm" variant="outline" onClick={() => navigate("/agenda")}>
          Configurar <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      ),
    },
    {
      key: "mp",
      done: state.mp,
      to: "/mi-consultorio?tab=pagos",
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
      to: null as string | null,
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
      to: "/personalizar-portal",
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
      to: "/patients",
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
      to: "/mi-consultorio?tab=notificaciones",
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
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/70 hover:bg-muted/40 transition-colors px-3.5 py-2.5"
    >
      {it.done ? (
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
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
      {it.done ? (
        // Ya está hecho, pero el acceso queda a la mano para volver cuando quieras
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
          title={it.key === "shared" ? "Copiar link" : "Ir a esta sección"}
          onClick={() => (it.key === "shared" ? handleCopy() : it.to && navigate(it.to))}
        >
          {it.key === "shared" ? <Copy className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </Button>
      ) : (
        it.action
      )}
    </li>
  );

  const totalSteps = items.length + extraItems.length;
  const totalDone = doneCount + extrasDoneCount;
  const progressPct = Math.round((totalDone / totalSteps) * 100);

  return (
    <Card className="relative overflow-hidden rounded-2xl border-primary/25 bg-card shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)]">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-primary/50 via-primary to-primary/50" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent pointer-events-none" />
      <CardContent className="relative p-4 sm:p-5 space-y-3">
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
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:block w-28">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                  {essentialsDone
                    ? `${extrasDoneCount}/${extraItems.length}`
                    : `${doneCount}/${items.length}`}
                </span>
                <span className="text-[10px] font-semibold text-primary tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
            <span className="sm:hidden text-sm font-medium text-muted-foreground tabular-nums">
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
              <div className="flex items-center justify-end gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Lo esencial ya está pronto, esta guía es opcional.
                </p>
                <Button variant="outline" size="sm" onClick={hideExtras} className="text-xs h-7 shrink-0">
                  Quitar del dashboard
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
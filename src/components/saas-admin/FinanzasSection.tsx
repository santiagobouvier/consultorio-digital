import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, DollarSign, Building2, Users, MessageSquare, TrendingUp,
  Pencil, ShieldAlert, Calculator, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { PLAN_DEFINITIONS, normalizePlanCode, getPlanPrice } from "@/lib/plan-definitions";

// Sección Finanzas del panel admin:
//  1) La realidad: MRR, consultorios por plan, pacientes, costo WhatsApp del
//     mes y neto estimado.
//  2) Parámetros de costos editables SOLO con confirmación fuerte (escribir
//     CONFIRMAR): viven en platform_settings (RLS superadmin).
//  3) Simulador "¿cuánto gano si...?": clientes por plan × pacientes
//     promedio → ingresos, costos y neto, usando esos mismos parámetros.

interface BusinessRow {
  id: string;
  name: string;
  plan_code: string;
  billing_period: string;
  is_demo: boolean;
  is_active: boolean;
}

interface SubscriptionRow {
  business_id: string;
  status: string;
  created_at: string;
}

interface SettingRow {
  key: string;
  value: number;
  updated_at: string;
}

const SETTING_META: Record<string, { label: string; hint: string; step: string; unit: string }> = {
  whatsapp_msg_cost_usd: {
    label: "Costo por mensaje de WhatsApp",
    hint: "Lo que Meta te cobra por cada mensaje de utilidad entregado. Si Meta cambia la tarifa, actualizalo acá y todo el panel se recalcula.",
    step: "0.0001",
    unit: "US$",
  },
  usd_to_uyu: {
    label: "Tipo de cambio (pesos por dólar)",
    hint: "Se usa para convertir los costos de Meta (en dólares) a pesos uruguayos.",
    step: "0.5",
    unit: "UYU",
  },
  msgs_per_patient_month: {
    label: "Mensajes por paciente por mes (estimado)",
    hint: "Promedio de WhatsApps automáticos que genera un paciente activo (confirmaciones + recordatorios + avisos). Se usa en el simulador.",
    step: "0.5",
    unit: "msgs",
  },
};

const fmtUYU = (n: number) =>
  `$ ${n.toLocaleString("es-UY", { maximumFractionDigits: 0 })}`;
const fmtUSD = (n: number) =>
  `US$ ${n.toLocaleString("es-UY", { maximumFractionDigits: 2 })}`;

const SIM_PLANS = ["emprendedor", "esencial", "profesional", "consultorio"] as const;
const SIM_DEFAULT_PATIENTS: Record<string, number> = {
  emprendedor: 15,
  esencial: 35,
  profesional: 80,
  consultorio: 200,
};

export const FinanzasSection = () => {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [activePatients, setActivePatients] = useState(0);
  const [waSentThisMonth, setWaSentThisMonth] = useState(0);
  const [settings, setSettings] = useState<SettingRow[]>([]);

  // Edición de parámetro con confirmación fuerte
  const [editing, setEditing] = useState<SettingRow | null>(null);
  const [newValue, setNewValue] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);

  // Simulador
  const [simClients, setSimClients] = useState<Record<string, number>>({
    emprendedor: 0, esencial: 10, profesional: 0, consultorio: 0,
  });
  const [simPatients, setSimPatients] = useState<Record<string, number>>({ ...SIM_DEFAULT_PATIENTS });
  const [simBilling, setSimBilling] = useState<"annual" | "monthly">("annual");

  const load = async () => {
    try {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const [bizRes, subsRes, patRes, waRes, setRes] = await Promise.all([
        supabase.from("businesses").select("id, name, plan_code, billing_period, is_demo, is_active"),
        supabase.from("subscriptions").select("business_id, status, created_at"),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("scheduled_reminders")
          .select("id", { count: "exact", head: true })
          .eq("channel", "whatsapp")
          .eq("status", "sent")
          .gte("scheduled_for", monthStart.toISOString()),
        supabase.from("platform_settings").select("key, value, updated_at"),
      ]);
      setBusinesses((bizRes.data as BusinessRow[]) || []);
      setSubscriptions((subsRes.data as SubscriptionRow[]) || []);
      setActivePatients(patRes.count ?? 0);
      setWaSentThisMonth(waRes.count ?? 0);
      setSettings(((setRes.data as any[]) || []).map((s) => ({ ...s, value: Number(s.value) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const getSetting = (key: string, fallback: number) =>
    settings.find((s) => s.key === key)?.value ?? fallback;

  const msgCostUsd = getSetting("whatsapp_msg_cost_usd", 0.0113);
  const fx = getSetting("usd_to_uyu", 40);
  const msgsPerPatient = getSetting("msgs_per_patient_month", 6);

  // ── La realidad ──
  // Solo cuentan para el MRR los consultorios que están PAGANDO (suscripción
  // 'active'). Los de prueba no pagan todavía (se muestran aparte como
  // futuro ingreso) y los expirados/cancelados no generan nada.
  const real = useMemo(() => {
    // Última suscripción de cada negocio
    const latestSub = new Map<string, SubscriptionRow>();
    for (const s of subscriptions) {
      const prev = latestSub.get(s.business_id);
      if (!prev || s.created_at > prev.created_at) latestSub.set(s.business_id, s);
    }

    const candidates = businesses.filter((b) => !b.is_demo);
    const paying = candidates.filter((b) => latestSub.get(b.id)?.status === "active" && b.is_active);
    const trials = candidates.filter((b) => latestSub.get(b.id)?.status === "trial" && b.is_active);
    const expired = candidates.filter((b) => {
      const st = latestSub.get(b.id)?.status;
      return !b.is_active || st === "expired" || st === "cancelled" || st === "paused";
    });

    const mrr = paying.reduce((sum, b) => {
      const code = normalizePlanCode(b.plan_code);
      return sum + getPlanPrice(code, b.billing_period === "monthly" ? "monthly" : "annual");
    }, 0);
    const byPlan = new Map<string, number>();
    for (const b of paying) {
      const code = normalizePlanCode(b.plan_code);
      byPlan.set(code, (byPlan.get(code) || 0) + 1);
    }
    const waCostUyu = waSentThisMonth * msgCostUsd * fx;
    return {
      paying: paying.length,
      trials: trials.length,
      expired: expired.length,
      mrr, byPlan, waCostUyu,
      net: mrr - waCostUyu,
    };
  }, [businesses, subscriptions, waSentThisMonth, msgCostUsd, fx]);

  // ── Simulador ──
  const sim = useMemo(() => {
    let income = 0;
    let totalPatients = 0;
    let totalClients = 0;
    for (const code of SIM_PLANS) {
      const n = simClients[code] || 0;
      if (n <= 0) continue;
      totalClients += n;
      income += n * getPlanPrice(code, simBilling);
      totalPatients += n * (simPatients[code] || 0);
    }
    const msgs = totalPatients * msgsPerPatient;
    const waCostUyu = msgs * msgCostUsd * fx;
    const net = income - waCostUyu;
    return { income, totalPatients, totalClients, msgs, waCostUyu, net };
  }, [simClients, simPatients, simBilling, msgsPerPatient, msgCostUsd, fx]);

  // ── Guardar parámetro (con palabra de confirmación) ──
  const openEdit = (s: SettingRow) => {
    setEditing(s);
    setNewValue(String(s.value));
    setConfirmWord("");
  };

  const saveSetting = async () => {
    if (!editing) return;
    const parsed = Number(newValue.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Valor inválido", description: "Tiene que ser un número mayor a 0.", variant: "destructive" });
      return;
    }
    if (confirmWord.trim().toUpperCase() !== "CONFIRMAR") {
      toast({ title: "Falta la confirmación", description: 'Escribí la palabra CONFIRMAR para guardar.', variant: "destructive" });
      return;
    }
    setSavingSetting(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .update({ value: parsed, updated_at: new Date().toISOString() })
        .eq("key", editing.key);
      if (error) throw error;
      toast({ title: "Parámetro actualizado ✓", description: `${SETTING_META[editing.key]?.label}: ${editing.value} → ${parsed}` });
      setEditing(null);
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar el parámetro.", variant: "destructive" });
    } finally {
      setSavingSetting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando finanzas...
      </div>
    );
  }

  const editMeta = editing ? SETTING_META[editing.key] : null;
  const parsedNew = Number(newValue.replace(",", "."));
  const changed = editing && Number.isFinite(parsedNew) && parsedNew !== editing.value;

  return (
    <div className="space-y-8">
      {/* ═══ 1) La realidad ═══ */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 mb-3">Tu negocio hoy</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <KpiCard
            icon={DollarSign} accent="text-emerald-400"
            label="Ingresos por mes (MRR)"
            value={fmtUYU(real.mrr)}
            sub={`${fmtUSD(real.mrr / fx)} · ${fmtUYU(real.mrr * 12)} al año — solo suscripciones pagando`}
          />
          <KpiCard
            icon={Building2} accent="text-teal-400"
            label="Consultorios pagando"
            value={String(real.paying)}
            sub={
              (SIM_PLANS.filter((c) => real.byPlan.get(c)).map((c) => `${real.byPlan.get(c)} ${PLAN_DEFINITIONS[c].name}`).join(" · ") || "Ninguno todavía") +
              ` · ${real.trials} en prueba · ${real.expired} vencidos`
            }
          />
          <KpiCard
            icon={MessageSquare} accent="text-green-400"
            label="WhatsApps del mes"
            value={String(waSentThisMonth)}
            sub={`Costo real: ${fmtUYU(real.waCostUyu)} (${fmtUSD(real.waCostUyu / fx)})`}
          />
          <KpiCard
            icon={TrendingUp} accent="text-blue-400"
            label="Neto estimado del mes"
            value={fmtUYU(real.net)}
            sub={`Ingresos − costo de WhatsApp · ${activePatients} pacientes activos`}
          />
        </div>
      </div>

      {/* ═══ 2) Parámetros de costos ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Parámetros de costos</p>
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
            <ShieldAlert className="h-3 w-3" /> Cambios con confirmación
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Object.entries(SETTING_META).map(([key, meta]) => {
            const s = settings.find((x) => x.key === key);
            return (
              <div key={key} className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-5 flex flex-col">
                <p className="text-xs text-slate-400 mb-1">{meta.label}</p>
                <p className="text-2xl font-semibold text-slate-100 tabular-nums">
                  {meta.unit === "US$" ? "US$ " : ""}{s ? s.value.toLocaleString("es-UY", { maximumFractionDigits: 4 }) : "—"}
                  {meta.unit !== "US$" ? <span className="text-sm text-slate-500 ml-1">{meta.unit}</span> : null}
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-2 flex-1">{meta.hint}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-600">
                    {s?.updated_at ? `Actualizado ${new Date(s.updated_at).toLocaleDateString("es-UY")}` : "Sin datos — corré la migración"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!s}
                    onClick={() => s && openEdit(s)}
                    className="h-8 rounded-lg gap-1.5 border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 3) Simulador ═══ */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-violet-400" />
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Simulador: ¿cuánto gano si…?</p>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-900/60 border border-slate-800 p-1">
            {(["annual", "monthly"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setSimBilling(b)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  simBilling === b ? "bg-violet-500/20 text-violet-300" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {b === "annual" ? "Precios anuales" : "Precios mensuales"}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden">
          {/* Entradas por plan */}
          <div className="divide-y divide-slate-800/60">
            {SIM_PLANS.map((code) => {
              const plan = PLAN_DEFINITIONS[code];
              const price = getPlanPrice(code, simBilling);
              return (
                <div key={code} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-center px-4 sm:px-5 py-3">
                  <div className="col-span-2 sm:col-span-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100">{plan.name}</p>
                    <p className="text-[11px] text-slate-500">{fmtUYU(price)}/mes por cliente</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-slate-500">Clientes</Label>
                    <Input
                      type="number" min={0}
                      value={simClients[code] === 0 ? "" : simClients[code]}
                      placeholder="0"
                      onChange={(e) => setSimClients((s) => ({ ...s, [code]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="h-9 rounded-lg bg-slate-950/60 border-slate-700 text-slate-100"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase tracking-wide text-slate-500">Pacientes c/u</Label>
                    <Input
                      type="number" min={0}
                      value={simPatients[code] === 0 ? "" : simPatients[code]}
                      placeholder="0"
                      onChange={(e) => setSimPatients((s) => ({ ...s, [code]: Math.max(0, parseInt(e.target.value) || 0) }))}
                      className="h-9 rounded-lg bg-slate-950/60 border-slate-700 text-slate-100"
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Ingreso</p>
                    <p className="text-sm font-semibold text-slate-100 tabular-nums">
                      {fmtUYU((simClients[code] || 0) * price)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resultado */}
          <div className="bg-slate-950/50 border-t border-slate-800/80 px-4 sm:px-5 py-4">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <ResultCell label="Clientes" value={String(sim.totalClients)} />
              <ResultCell label="Pacientes" value={sim.totalPatients.toLocaleString("es-UY")} />
              <ResultCell label="WhatsApps/mes" value={`${Math.round(sim.msgs).toLocaleString("es-UY")}`} sub={`Costo ${fmtUYU(sim.waCostUyu)}`} />
              <ResultCell label="Ingresos/mes" value={fmtUYU(sim.income)} sub={fmtUSD(sim.income / fx)} />
              <ResultCell
                label="NETO/mes" strong
                value={fmtUYU(sim.net)}
                sub={`${fmtUSD(sim.net / fx)} · ${fmtUYU(sim.net * 12)} al año`}
              />
            </div>
            <button
              onClick={() => {
                setSimClients({ emprendedor: 0, esencial: 10, profesional: 0, consultorio: 0 });
                setSimPatients({ ...SIM_DEFAULT_PATIENTS });
              }}
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
            >
              <RotateCcw className="h-3 w-3" /> Restaurar ejemplo
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Diálogo de edición con confirmación fuerte ═══ */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="dark max-w-md bg-[#0e1417] border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              Cambiar parámetro
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {editMeta?.label}. Este valor afecta todos los cálculos del panel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-500">Valor actual</p>
                <p className="font-semibold tabular-nums">{editing?.value}</p>
              </div>
              <span className="text-slate-600">→</span>
              <div className="text-right">
                <p className="text-[11px] text-slate-500">Valor nuevo</p>
                <p className={`font-semibold tabular-nums ${changed ? "text-amber-300" : "text-slate-500"}`}>
                  {Number.isFinite(parsedNew) && newValue !== "" ? parsedNew : "—"}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">Nuevo valor</Label>
              <Input
                type="number"
                step={editMeta?.step}
                min="0"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="rounded-xl bg-slate-950/60 border-slate-700 text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">
                Escribí <span className="font-mono font-bold text-amber-300">CONFIRMAR</span> para guardar
              </Label>
              <Input
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                placeholder="CONFIRMAR"
                autoComplete="off"
                className="rounded-xl bg-slate-950/60 border-slate-700 text-slate-100 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} className="rounded-xl border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-800">
              Cancelar
            </Button>
            <Button
              onClick={saveSetting}
              disabled={savingSetting || !changed || confirmWord.trim().toUpperCase() !== "CONFIRMAR"}
              className="rounded-xl"
            >
              {savingSetting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Guardar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KpiCard = ({
  icon: Icon, accent, label, value, sub,
}: { icon: typeof DollarSign; accent: string; label: string; value: string; sub?: string }) => (
  <div className="rounded-2xl bg-slate-900/40 border border-slate-800/80 p-5">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-8 w-8 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-center">
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
    <p className="text-2xl font-semibold text-slate-100 tabular-nums">{value}</p>
    {sub && <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{sub}</p>}
  </div>
);

const ResultCell = ({
  label, value, sub, strong,
}: { label: string; value: string; sub?: string; strong?: boolean }) => (
  <div className={strong ? "rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 -my-1" : ""}>
    <p className={`text-[10px] uppercase tracking-wide ${strong ? "text-emerald-400" : "text-slate-500"}`}>{label}</p>
    <p className={`font-semibold tabular-nums ${strong ? "text-emerald-300 text-lg" : "text-slate-100"}`}>{value}</p>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

export default FinanzasSection;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Activity, AlertTriangle, HeartPulse, Loader2, Pencil, Pill, Plus, Stethoscope,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { RISK_FLAG_LABELS, type RiskFlag } from "@/lib/patient-profile";

// ESTADO ACTUAL del paciente: qué medicación toma hoy, qué diagnóstico tiene,
// si hay riesgo. Es un estado presente, no un evento del pasado: va fijo
// arriba de la cronología y visualmente separado de ella.
//
// Vive en patient_clinical_status (tabla sin ninguna política RLS para
// pacientes). Este bloque NUNCA se renderiza en el portal del paciente:
// solo lo ve el profesional a cargo, dentro del expediente.

interface ClinicalRow {
  current_medication: string | null;
  current_diagnosis: string | null;
  medical_history: string | null;
  risk_flag: RiskFlag;
  risk_notes: string | null;
  updated_at: string;
}

interface ClinicalStatusBlockProps {
  patientId: string;
  businessId: string;
  /** Se llama después de guardar (la entrada automática ya quedó en la cronología). */
  onSaved?: () => void;
}

const EMPTY_FORM = {
  current_medication: "",
  current_diagnosis: "",
  medical_history: "",
  risk_flag: "ninguno" as RiskFlag,
  risk_notes: "",
};

export const ClinicalStatusBlock = ({ patientId, businessId, onSaved }: ClinicalStatusBlockProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<ClinicalRow | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from("patient_clinical_status")
      .select("current_medication, current_diagnosis, medical_history, risk_flag, risk_notes, updated_at")
      .eq("patient_id", patientId)
      .maybeSingle();
    setRow((data as ClinicalRow | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const openEditor = () => {
    setForm({
      current_medication: row?.current_medication ?? "",
      current_diagnosis: row?.current_diagnosis ?? "",
      medical_history: row?.medical_history ?? "",
      risk_flag: row?.risk_flag ?? "ninguno",
      risk_notes: row?.risk_notes ?? "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const clean = {
        current_medication: form.current_medication.trim() || null,
        current_diagnosis: form.current_diagnosis.trim() || null,
        medical_history: form.medical_history.trim() || null,
        risk_flag: form.risk_flag,
        risk_notes: form.risk_flag === "ninguno" ? null : form.risk_notes.trim() || null,
      };

      // Qué cambió (solo los nombres de campo — sin diffs ni valores viejos)
      const changed: string[] = [];
      if (clean.current_medication !== (row?.current_medication ?? null)) changed.push("Medicación");
      if (clean.current_diagnosis !== (row?.current_diagnosis ?? null)) changed.push("Diagnóstico");
      if (clean.medical_history !== (row?.medical_history ?? null)) changed.push("Antecedentes");
      if (clean.risk_flag !== (row?.risk_flag ?? "ninguno") || clean.risk_notes !== (row?.risk_notes ?? null)) {
        changed.push("Riesgo");
      }

      if (changed.length === 0) {
        setEditing(false);
        return;
      }

      // El upsert solo toca estos campos: no pisa treatment_status, que se
      // edita desde el perfil. updated_at lo setea el trigger de la tabla.
      const { error } = await supabase
        .from("patient_clinical_status")
        .upsert({ patient_id: patientId, business_id: businessId, ...clean }, { onConflict: "patient_id" });
      if (error) throw error;

      // Registro automático en la cronología: qué se actualizó y cuándo.
      // Es lo que convierte el bloque en estado actual + historial de cambios.
      const { error: noteError } = await supabase.from("session_notes").insert({
        business_id: businessId,
        patient_id: patientId,
        appointment_id: null,
        author_user_id: user.id,
        note_date: format(new Date(), "yyyy-MM-dd"),
        content: `Estado clínico actualizado — ${changed.join(", ")}`,
        status: "finalized",
      });
      if (noteError) console.error("No se pudo registrar el cambio en la cronología:", noteError);

      toast({ title: "Estado actual guardado ✓" });
      setEditing(false);
      await fetchStatus();
      onSaved?.();
    } catch (err) {
      console.error("Error guardando estado clínico:", err);
      toast({ title: "Error", description: "No se pudo guardar el estado actual", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const hasContent = !!(
    row &&
    (row.current_medication || row.current_diagnosis || row.medical_history || row.risk_flag !== "ninguno")
  );
  const risk = row?.risk_flag ?? "ninguno";

  const FieldRow = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: typeof Pill;
    label: string;
    value: string | null;
  }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3">
        <div className="shrink-0 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-sm mt-0.5 whitespace-pre-wrap break-words leading-relaxed">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <Card className="rounded-2xl border-primary/25 bg-gradient-to-b from-primary/[0.05] to-transparent">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Estado actual
            </p>
            {hasContent && (
              <Button size="sm" variant="ghost" className="h-7 rounded-lg gap-1.5 text-xs -mr-1" onClick={openEditor}>
                <Pencil className="h-3 w-3" /> Editar
              </Button>
            )}
          </div>

          {!hasContent ? (
            <div className="pt-1">
              <p className="text-sm text-muted-foreground mb-3">
                Medicación, diagnóstico, antecedentes y riesgo: lo que hay que ver de un vistazo
                antes de cada sesión.
              </p>
              <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={openEditor}>
                <Plus className="h-4 w-4" /> Completar estado actual
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Alerta de riesgo: arriba de todo, se ve sin buscarla */}
              {risk !== "ninguno" && (
                <div
                  className={cn(
                    "rounded-xl border p-3 flex items-start gap-2.5",
                    risk === "riesgo_alto"
                      ? "bg-rose-500/10 border-rose-500/40"
                      : "bg-amber-500/10 border-amber-500/40"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      risk === "riesgo_alto" ? "text-rose-500" : "text-amber-500"
                    )}
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        risk === "riesgo_alto"
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {RISK_FLAG_LABELS[risk]}
                    </p>
                    {row?.risk_notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                        {row.risk_notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <FieldRow icon={Pill} label="Medicación actual" value={row?.current_medication ?? null} />
              <FieldRow icon={Stethoscope} label="Diagnóstico / cuadro actual" value={row?.current_diagnosis ?? null} />
              <FieldRow icon={HeartPulse} label="Antecedentes y alergias" value={row?.medical_history ?? null} />

              {row?.updated_at && (
                <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                  Actualizado el {format(new Date(row.updated_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Editor ── */}
      <Dialog open={editing} onOpenChange={(o) => !saving && setEditing(o)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estado actual</DialogTitle>
            <DialogDescription>
              Al guardar queda registrado en la cronología qué campos se actualizaron.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Medicación actual</Label>
              <Textarea
                value={form.current_medication}
                onChange={(e) => setForm((f) => ({ ...f, current_medication: e.target.value }))}
                rows={2}
                placeholder="Ej: Sertralina 50 mg/día"
                className="rounded-xl resize-y text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Diagnóstico o cuadro actual</Label>
              <Textarea
                value={form.current_diagnosis}
                onChange={(e) => setForm((f) => ({ ...f, current_diagnosis: e.target.value }))}
                rows={2}
                placeholder="Ej: trastorno de ansiedad generalizada"
                className="rounded-xl resize-y text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Antecedentes médicos y alergias</Label>
              <Textarea
                value={form.medical_history}
                onChange={(e) => setForm((f) => ({ ...f, medical_history: e.target.value }))}
                rows={2}
                placeholder="Ej: alergia a penicilina; hipotiroidismo"
                className="rounded-xl resize-y text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Riesgo</Label>
              <Select
                value={form.risk_flag}
                onValueChange={(v) => setForm((f) => ({ ...f, risk_flag: v as RiskFlag }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(RISK_FLAG_LABELS) as [RiskFlag, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.risk_flag !== "ninguno" && (
              <div className="space-y-1.5">
                <Label>Notas sobre el riesgo</Label>
                <Textarea
                  value={form.risk_notes}
                  onChange={(e) => setForm((f) => ({ ...f, risk_notes: e.target.value }))}
                  rows={2}
                  placeholder="Qué mirar, acordado con quién, desde cuándo..."
                  className="rounded-xl resize-y text-sm"
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="rounded-xl w-full sm:w-auto" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ClinicalStatusBlock;

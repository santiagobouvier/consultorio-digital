// Gestión de "Tipos de sesión" (services): nombre, duración, modalidad y precio.
// Etapa 1 de Horarios 2.0 — aditiva: todavía nada consume estos servicios; en
// las etapas siguientes la reserva (pública y portal) ofrecerá inicios según
// la duración del servicio elegido.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Pencil, Loader2, Video, MapPin } from "lucide-react";

export interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  mode: string;
  suggested_price: number | null;
  is_active: boolean;
}

const DURATIONS = [30, 45, 50, 60, 90, 120];

const MODE_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  ambas: "Online o presencial",
};

interface Props {
  businessId: string;
}

export function ServicesManager({ businessId }: Props) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    duration: "50",
    mode: "ambas",
    price: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, duration_minutes, mode, suggested_price, is_active")
        .eq("business_id", businessId)
        .order("duration_minutes", { ascending: true });
      if (error) throw error;
      setServices((data ?? []) as ServiceRow[]);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudieron cargar los tipos de sesión", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", duration: "50", mode: "ambas", price: "" });
    setDialogOpen(true);
  };

  const openEdit = (s: ServiceRow) => {
    setEditing(s);
    setForm({
      name: s.name,
      duration: String(s.duration_minutes),
      mode: s.mode || "ambas",
      price: s.suggested_price != null ? String(s.suggested_price) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      toast({ title: "Poné un nombre", description: "Ej: Sesión individual", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        duration_minutes: parseInt(form.duration),
        mode: form.mode,
        suggested_price: form.price ? parseFloat(form.price) : null,
      };
      if (editing) {
        const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("services")
          .insert({ ...payload, business_id: businessId, is_active: true });
        if (error) throw error;
      }
      toast({ title: editing ? "Tipo de sesión actualizado" : "Tipo de sesión creado" });
      setDialogOpen(false);
      await load();
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: ServiceRow, active: boolean) => {
    // Soft on/off: nunca borramos (las citas viejas pueden referenciarlo)
    setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: active } : x)));
    const { error } = await supabase.from("services").update({ is_active: active }).eq("id", s.id);
    if (error) {
      console.error(error);
      setServices((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !active } : x)));
      toast({ title: "Error", description: "No se pudo actualizar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Tipos de sesión
            </CardTitle>
            <CardDescription>
              Lo que ofrecés: cada tipo tiene su duración y precio. Tus pacientes van a elegir uno al reservar.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Agregar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
          </div>
        ) : services.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Todavía no definiste ningún tipo de sesión.
            </p>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Crear el primero (ej: "Sesión individual · 50 min")
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {services.map((s) => (
              <li
                key={s.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${s.is_active ? "bg-card" : "bg-muted/40 opacity-70"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{s.duration_minutes} min</span>
                    <span className="inline-flex items-center gap-1">
                      {s.mode === "online" ? <Video className="h-3 w-3" /> : s.mode === "presencial" ? <MapPin className="h-3 w-3" /> : null}
                      {MODE_LABEL[s.mode] ?? s.mode}
                    </span>
                    {s.suggested_price != null && <span>${s.suggested_price.toLocaleString("es-UY")}</span>}
                  </p>
                </div>
                {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s, v)} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tipo de sesión" : "Nuevo tipo de sesión"}</DialogTitle>
            <DialogDescription>
              Nombre, duración y precio de esta sesión.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                placeholder="Ej: Sesión individual"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duración</Label>
                <Select value={form.duration} onValueChange={(v) => setForm((f) => ({ ...f, duration: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>{d} minutos</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Precio (opcional)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Ej: 1500"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modalidad</Label>
              <Select value={form.mode} onValueChange={(v) => setForm((f) => ({ ...f, mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambas">Online o presencial</SelectItem>
                  <SelectItem value="online">Solo online</SelectItem>
                  <SelectItem value="presencial">Solo presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Guardar cambios" : "Crear tipo de sesión"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

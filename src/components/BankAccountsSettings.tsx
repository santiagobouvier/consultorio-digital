import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Banknote, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

// Cuentas bancarias del consultorio: se cargan una vez acá y después se
// mandan al paciente por WhatsApp desde el menú "Avisar" de cualquier pago.
// Cambiás de banco → editás acá y todos los mensajes salen actualizados.

interface BankAccount {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  currency: string;
  notes: string | null;
}

interface Props {
  businessId: string;
}

const EMPTY_FORM = {
  bank_name: "",
  account_holder: "",
  account_number: "",
  currency: "UYU",
  notes: "",
};

export const BankAccountsSettings = ({ businessId }: Props) => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from("business_bank_accounts")
      .select("id, bank_name, account_holder, account_number, currency, notes")
      .eq("business_id", businessId)
      .order("created_at");
    if (error) {
      console.error("Error cargando cuentas:", error);
    } else {
      setAccounts((data as BankAccount[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const openEditor = (account?: BankAccount) => {
    if (account) {
      setEditingId(account.id);
      setForm({
        bank_name: account.bank_name,
        account_holder: account.account_holder,
        account_number: account.account_number,
        currency: account.currency,
        notes: account.notes ?? "",
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setEditorOpen(true);
  };

  const save = async () => {
    if (!form.bank_name.trim() || !form.account_holder.trim() || !form.account_number.trim()) {
      toast({
        title: "Faltan datos",
        description: "Banco, titular y número de cuenta son obligatorios.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        bank_name: form.bank_name.trim(),
        account_holder: form.account_holder.trim(),
        account_number: form.account_number.trim(),
        currency: form.currency,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("business_bank_accounts")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("business_bank_accounts")
          .insert({ business_id: businessId, ...payload });
        if (error) throw error;
      }
      toast({ title: editingId ? "Cuenta actualizada" : "Cuenta agregada" });
      setEditorOpen(false);
      await fetchAccounts();
    } catch (err) {
      console.error("Error guardando cuenta:", err);
      toast({ title: "Error", description: "No se pudo guardar la cuenta", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from("business_bank_accounts").delete().eq("id", deletingId);
    if (error) {
      toast({ title: "Error", description: "No se pudo eliminar la cuenta", variant: "destructive" });
    } else {
      toast({ title: "Cuenta eliminada" });
      await fetchAccounts();
    }
    setDeletingId(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Cuentas para transferencias
          </CardTitle>
          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 h-8" onClick={() => openEditor()}>
            <Plus className="h-3.5 w-3.5" /> Agregar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Se mandan al paciente por WhatsApp desde el botón "Avisar" de cualquier pago.
          Podés tener varias (pesos, dólares, distintos bancos).
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <button
            onClick={() => openEditor()}
            className="w-full rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/[0.03] transition-colors p-4 text-left"
          >
            <p className="text-sm font-medium">Todavía no cargaste ninguna cuenta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Agregá tu cuenta bancaria y mandá los datos de transferencia con un toque.
            </p>
          </button>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
              >
                <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Banknote className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                    {a.bank_name}
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      {a.currency === "USD" ? "Dólares" : "Pesos"}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.account_holder} · {a.account_number}
                  </p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => openEditor(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingId(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* ── Alta / edición ── */}
      <Dialog open={editorOpen} onOpenChange={(o) => !saving && setEditorOpen(o)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
            <DialogDescription>
              Estos datos van tal cual en el mensaje de WhatsApp al paciente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Banco *</Label>
                <Input
                  value={form.bank_name}
                  onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                  placeholder="BROU, Itaú, Prex..."
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moneda</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">Pesos uruguayos</SelectItem>
                    <SelectItem value="USD">Dólares</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Titular *</Label>
              <Input
                value={form.account_holder}
                onChange={(e) => setForm((f) => ({ ...f, account_holder: e.target.value }))}
                placeholder="Nombre como figura en el banco"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Número de cuenta *</Label>
              <Input
                value={form.account_number}
                onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
                placeholder="001234567-00001"
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Aclaración (opcional)</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Ej: Caja de ahorro · sucursal 19"
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" className="rounded-xl w-full sm:w-auto" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="rounded-xl w-full sm:w-auto" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar borrado ── */}
      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en el menú de WhatsApp de los pagos. No afecta mensajes ya enviados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default BankAccountsSettings;

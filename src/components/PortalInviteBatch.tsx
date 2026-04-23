import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Mail, Loader2, UserPlus, CheckCircle2, Search, RefreshCw } from "lucide-react";
import { ListPagination, ITEMS_PER_PAGE } from "@/components/ListPagination";

interface PendingPatient {
  id: string;
  full_name: string;
  email: string | null;
}

interface PortalInviteBatchProps {
  businessId: string | null;
}

const isRealEmail = (email?: string | null): email is string => {
  if (!email) return false;
  if (email.endsWith("@portal.interno")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const PortalInviteBatch = ({ businessId }: PortalInviteBatchProps) => {
  const [patients, setPatients] = useState<PendingPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const loadPatients = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, email")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .is("auth_user_id", null)
      .order("full_name", { ascending: true });

    if (error) {
      toast({ title: "Error al cargar pacientes", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setPatients(data || []);
    setSelected(new Set());
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const filtered = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.full_name.toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  });

  const eligibleIds = filtered.filter((p) => isRealEmail(p.email)).map((p) => p.id);
  const allSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageItems = filtered.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(eligibleIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendInvites = async () => {
    if (selected.size === 0) return;
    setSending(true);
    const ids = Array.from(selected);
    let ok = 0;
    let fail = 0;

    for (const patientId of ids) {
      try {
        const { data, error } = await supabase.functions.invoke("create-patient-invite", {
          body: { patientId },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.message || data.error);
        ok += 1;
      } catch (err) {
        console.error("Invite failed for", patientId, err);
        fail += 1;
      }
    }

    setSending(false);
    if (ok > 0) {
      toast({
        title: `Invitaciones enviadas (${ok})`,
        description: fail > 0 ? `${fail} no pudieron enviarse.` : "Los pacientes recibirán un correo con el acceso.",
      });
    } else {
      toast({
        title: "No se pudo enviar ninguna invitación",
        description: "Revisá los correos de los pacientes e intentá de nuevo.",
        variant: "destructive",
      });
    }
    await loadPatients();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" /> Invitar pacientes al portal
            </CardTitle>
            <CardDescription>
              Pacientes de tu consultorio que todavía no tienen acceso al portal. Seleccioná uno o varios y enviales la invitación.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPatients}
            disabled={loading}
            className="gap-2 self-start"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Cargando pacientes...
          </div>
        ) : patients.length === 0 ? (
          <div className="rounded-xl bg-muted/50 border border-dashed border-border p-6 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
            <p className="text-sm font-medium">Todos tus pacientes ya tienen acceso al portal</p>
            <p className="text-xs text-muted-foreground">
              Cuando agregues nuevos pacientes vas a poder invitarlos desde acá.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar por nombre o correo"
                  className="pl-9 h-10"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAll}
                disabled={eligibleIds.length === 0}
                className="h-10"
              >
                {allSelected ? "Quitar selección" : "Seleccionar todos"}
              </Button>
            </div>

            <div className="rounded-xl border border-border divide-y divide-border">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No se encontraron pacientes con ese criterio.
                </div>
              ) : (
                pageItems.map((p) => {
                  const hasEmail = isRealEmail(p.email);
                  const isChecked = selected.has(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 px-3 sm:px-4 py-3 transition-colors ${
                        hasEmail ? "cursor-pointer hover:bg-muted/40" : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={!hasEmail || sending}
                        onCheckedChange={() => hasEmail && toggleOne(p.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        {hasEmail ? (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            {p.email}
                          </p>
                        ) : (
                          <p className="text-xs text-destructive truncate">
                            Sin correo válido — agregalo desde la ficha del paciente
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filtered.length}
              pageSize={ITEMS_PER_PAGE}
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                {selected.size > 0
                  ? `${selected.size} paciente${selected.size === 1 ? "" : "s"} seleccionado${selected.size === 1 ? "" : "s"}`
                  : `${patients.length} paciente${patients.length === 1 ? "" : "s"} sin acceso al portal`}
              </p>
              <Button
                onClick={sendInvites}
                disabled={selected.size === 0 || sending}
                className="gap-2 w-full sm:w-auto"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Enviar invitación{selected.size > 1 ? "es" : ""}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
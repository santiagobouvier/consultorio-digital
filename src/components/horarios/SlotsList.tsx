import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ListPagination, ITEMS_PER_PAGE } from "@/components/ListPagination";

export interface SlotRow {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  modality: string;
  price: number | null;
  status: string;
  notes: string | null;
  generated_from_template?: string | null;
}

interface Props {
  slots: SlotRow[];
  onChange: () => void;
}

export const SlotsList = ({ slots, onChange }: Props) => {
  const [filter, setFilter] = useState<string>("upcoming");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    let list = slots;
    if (filter === "upcoming") list = list.filter((s) => s.date >= today);
    else if (filter === "past") list = list.filter((s) => s.date < today);
    else if (filter === "available") list = list.filter((s) => s.status === "available");
    else if (filter === "reserved") list = list.filter((s) => s.status === "reserved");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.date.includes(q) || s.modality.toLowerCase().includes(q));
    }
    return list;
  }, [slots, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageSlots = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleBlock = async (id: string) => {
    const { error } = await (supabase as any).from("availability_slots").update({ status: "blocked" }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Horario bloqueado" });
    onChange();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("availability_slots").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Horario eliminado" });
    onChange();
  };

  const getBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      available: "default",
      reserved: "secondary",
      blocked: "destructive",
    };
    const labels: Record<string, string> = {
      available: "Disponible",
      reserved: "Reservado",
      blocked: "Bloqueado",
    };
    return <Badge variant={variants[status] ?? "default"}>{labels[status] ?? status}</Badge>;
  };

  // Sin horarios sueltos: un mensaje corto y nada más (ni buscador ni filtros)
  if (slots.length === 0) {
    return (
      <p className="text-muted-foreground text-xs py-4 text-center">
        No tenés horarios sueltos cargados.
      </p>
    );
  }

  // Bloque plano pensado para vivir dentro de la tarjeta "¿Abrís un día
  // puntual?" (columna angosta): título arriba, controles en su propia fila
  // que se adapta a cualquier ancho sin desbordar.
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">
          Horarios cargados <span className="text-muted-foreground font-normal">({filtered.length})</span>
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-8 h-9 w-full"
            />
          </div>
          <Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[120px] shrink-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upcoming">Próximos</SelectItem>
              <SelectItem value="past">Pasados</SelectItem>
              <SelectItem value="available">Disponibles</SelectItem>
              <SelectItem value="reserved">Reservados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {pageSlots.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6 text-center">No hay horarios con esos filtros.</p>
      ) : (
        <div className="space-y-2">
          {pageSlots.map((slot) => (
            <div key={slot.id} className="flex items-center gap-2 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm">
                    {format(new Date(slot.date + "T00:00:00"), "EEE d MMM", { locale: es })}
                  </span>
                  {getBadge(slot.status)}
                  {slot.generated_from_template && (
                    <Badge variant="outline" className="text-[10px]">Plantilla</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)} · {slot.modality}
                  {slot.price && ` · $${slot.price}`}
                </div>
              </div>
              {slot.status === "available" && (
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={() => handleBlock(slot.id)}>Bloquear</Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(slot.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ListPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={filtered.length}
        pageSize={ITEMS_PER_PAGE}
      />
    </div>
  );
};

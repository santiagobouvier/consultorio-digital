import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, Crown, User } from "lucide-react";
import {
  useBusinessProfessionals,
  type BusinessProfessional,
  type CoordinationMode,
} from "@/hooks/use-business-professionals";

interface Props {
  businessId: string;
}

export function ProfessionalsCoordinationSection({ businessId }: Props) {
  const { professionals, loading, updateCoordinationMode } = useBusinessProfessionals(businessId);
  const [pending, setPending] = useState<{ pro: BusinessProfessional; nextMode: CoordinationMode } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await updateCoordinationMode(pending.pro.userId, pending.nextMode);
      toast.success(
        pending.nextMode === "independent"
          ? "Modo independiente activado"
          : "Modo compartido activado",
      );
    } catch (e: any) {
      toast.error(e.message ?? "Error al cambiar el modo");
    } finally {
      setSaving(false);
      setPending(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" /> Modo de coordinación por profesional
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          <strong>Compartido:</strong> usa los espacios físicos del consultorio.{" "}
          <strong>Independiente:</strong> gestiona sus propios espacios (auto-generados "Mi consultorio" y
          "Online").
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando profesionales...</p>
        ) : professionals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay profesionales registrados.</p>
        ) : (
          professionals.map((p) => {
            const isIndependent = p.coordinationMode === "independent";
            return (
              <div
                key={p.userId}
                className="p-4 bg-muted/40 rounded-xl space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {p.isOwner ? (
                      <Crown className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <Badge variant={p.isOwner ? "default" : "secondary"} className="text-[10px]">
                        {p.isOwner ? "Propietario" : "Profesional"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Label className="text-xs text-muted-foreground">
                    {isIndependent ? "Independiente" : "Compartido"}
                  </Label>
                  <Switch
                    checked={isIndependent}
                    onCheckedChange={(checked) =>
                      setPending({ pro: p, nextMode: checked ? "independent" : "shared" })
                    }
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && !saving && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Cambiar modo a {pending?.nextMode === "independent" ? "Independiente" : "Compartido"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {pending?.nextMode === "independent" ? (
                  <>
                    <strong>{pending?.pro.name}</strong> gestionará sus propios espacios. Si no tiene, se
                    crearán automáticamente "Mi consultorio" y "Online".
                  </>
                ) : (
                  <>
                    <strong>{pending?.pro.name}</strong> volverá a usar los espacios compartidos del
                    consultorio. Sus espacios independientes quedarán inactivos.
                  </>
                )}
              </span>
              {pending && pending.pro.futureSharedAppointmentsCount > 0 && pending.nextMode === "independent" && (
                <span className="block text-amber-600 dark:text-amber-400">
                  Tiene {pending.pro.futureSharedAppointmentsCount} cita
                  {pending.pro.futureSharedAppointmentsCount === 1 ? "" : "s"} futura
                  {pending.pro.futureSharedAppointmentsCount === 1 ? "" : "s"} en espacios compartidos.
                  Mantendrán su espacio actual hasta que las edites manualmente.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={saving}>
              {saving ? "Guardando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { openWhatsApp } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

interface PaymentLinkMenuProps {
  patientPhone: string | null;
  patientName: string;
  /**
   * Genera (o reutiliza) el link de cobro de Mercado Pago. Si no está
   * presente (MP sin conectar), el menú muestra el camino para conectarlo.
   */
  getPaymentLink?: () => Promise<string>;
  /** Versión compacta (solo ícono): para lugares angostos como el panel de deudores. */
  compact?: boolean;
  /** Clases extra para el botón disparador (permite adaptarlo a cada layout). */
  className?: string;
}

/**
 * Botón dedicado al COBRO ONLINE de un pago: enviar el link de Mercado Pago
 * por WhatsApp o copiarlo. Separado a propósito del botón "Avisar".
 */
export function PaymentLinkMenu({
  patientPhone,
  patientName,
  getPaymentLink,
  compact = false,
  className,
}: PaymentLinkMenuProps) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const resolveLink = async (): Promise<string | null> => {
    if (!getPaymentLink) return null;
    setBusy(true);
    try {
      return await getPaymentLink();
    } catch (err: any) {
      toast({
        title: "No se pudo generar el link de pago",
        description: err?.message || "Probá de nuevo en unos segundos.",
        variant: "destructive",
      });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!patientPhone) {
      toast({
        title: "Sin número de WhatsApp",
        description: "Este paciente no tiene número de WhatsApp cargado",
        variant: "destructive",
      });
      return;
    }
    const link = await resolveLink();
    if (!link) return;
    const firstName = patientName.split(" ")[0];
    const message = `Hola ${firstName}, ¿cómo estás? Te paso el link para abonar tu consulta online, con tarjeta o dinero en Mercado Pago:\n${link}\n¡Gracias!`;
    openWhatsApp(patientPhone, message);
  };

  const handleCopy = async () => {
    const link = await resolveLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast({ title: "Link de pago copiado", description: "Pegalo donde quieras compartirlo." });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1 px-2.5 rounded-lg text-xs font-medium text-primary border-primary/30 hover:bg-primary/5 hover:text-primary", className)}
          title="Cobrar online con link de pago"
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {!compact && (
            <span>
              Link<span className="hidden md:inline"> de pago</span>
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {getPaymentLink ? (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cobro online · Mercado Pago
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={handleSendWhatsApp} className="gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              Enviar por WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar link
            </DropdownMenuItem>
          </>
        ) : (
          <div className="px-2 py-2">
            <p className="text-xs font-semibold flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              Link de pago online
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Conectá tu cuenta de Mercado Pago para cobrar esta sesión con un
              link que se marca pagado solo.
            </p>
            <Button
              size="sm"
              className="mt-2 h-8 w-full text-xs rounded-lg"
              onClick={() => navigate("/mi-consultorio?tab=pagos")}
            >
              Ir a conectar Mercado Pago
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

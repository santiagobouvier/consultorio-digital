import { useState } from "react";
import { ChevronDown, Loader2, MessageCircle } from "lucide-react";
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

interface PaymentWhatsAppMenuProps {
  patientPhone: string | null;
  patientName: string;
  /**
   * Si está presente, los avisos incluyen el link de cobro dentro del
   * mensaje (el botón de cobro online es aparte: PaymentLinkMenu).
   */
  getPaymentLink?: () => Promise<string>;
}

const WHATSAPP_MESSAGES = {
  expires_soon_10: (name: string) =>
    `Hola ${name}, ¿cómo estás? Te escribo para avisarte que en menos de 10 días vence tu próximo pago de consulta. Cualquier cosa que necesites, estoy a las órdenes.`,
  expires_soon: (name: string) =>
    `Hola ${name}, ¿cómo estás? Solo un recordatorio amable de que está por vencer tu pago de consulta. Si ya lo realizaste, podés ignorar este mensaje. ¡Gracias!`,
  overdue: (name: string) =>
    `Hola ${name}, ¿cómo estás? El sistema me notificó que pasó la fecha de tu pago de consulta. Cualquier cosa avisame y coordinamos, gracias.`,
};

/**
 * Botón "Avisar": recordatorios de vencimiento por WhatsApp. Cuando el
 * consultorio cobra online, el mensaje lleva el link de pago incluido.
 */
export function PaymentWhatsAppMenu({
  patientPhone,
  patientName,
  getPaymentLink,
}: PaymentWhatsAppMenuProps) {
  const [busy, setBusy] = useState(false);

  const handleSendMessage = async (messageType: keyof typeof WHATSAPP_MESSAGES) => {
    if (!patientPhone) {
      toast({
        title: "Sin número de WhatsApp",
        description: "Este paciente no tiene número de WhatsApp cargado",
        variant: "destructive",
      });
      return;
    }

    const firstName = patientName.split(" ")[0];
    let message = WHATSAPP_MESSAGES[messageType](firstName);

    if (getPaymentLink) {
      setBusy(true);
      try {
        const link = await getPaymentLink();
        message = `${message}\n\nPodés abonarlo online acá: ${link}`;
      } catch (err: any) {
        toast({
          title: "No se pudo generar el link de pago",
          description: err?.message || "El aviso se abre sin el link.",
        });
      } finally {
        setBusy(false);
      }
    }

    openWhatsApp(patientPhone, message);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 px-2.5 rounded-lg text-xs font-medium"
          title="Enviar aviso de vencimiento por WhatsApp"
          disabled={busy}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
          Avisar
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Avisos de vencimiento por WhatsApp
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleSendMessage("expires_soon_10")}>
          Se vence en menos de 10 días
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSendMessage("expires_soon")}>
          Se vence pronto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSendMessage("overdue")}>
          Pago vencido
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

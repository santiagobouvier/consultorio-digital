import { useState } from "react";
import { Copy, Link2, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface PaymentWhatsAppMenuProps {
  patientPhone: string | null;
  patientName: string;
  /**
   * Si está presente, el menú ofrece el link de cobro de Mercado Pago:
   * los avisos lo incluyen en el mensaje y aparecen las acciones
   * "Enviar link de pago" y "Copiar link de pago".
   * Debe devolver la URL del link (generándolo si hace falta).
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
  payment_link: (name: string) =>
    `Hola ${name}, ¿cómo estás? Te paso el link para abonar tu consulta de forma online, con tarjeta o dinero en Mercado Pago:`,
};

function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  // If it starts with 0, replace with country code (assume Uruguay 598)
  if (cleaned.startsWith("0")) {
    return "598" + cleaned.slice(1);
  }
  // If it doesn't start with country code, add 598
  if (!cleaned.startsWith("598") && cleaned.length <= 9) {
    return "598" + cleaned;
  }
  return cleaned;
}

function openWhatsApp(phone: string, message: string) {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  window.open(url, "_blank");
}

export function PaymentWhatsAppMenu({
  patientPhone,
  patientName,
  getPaymentLink,
}: PaymentWhatsAppMenuProps) {
  const [busy, setBusy] = useState(false);

  const requirePhone = (): boolean => {
    if (!patientPhone) {
      toast({
        title: "Sin número de WhatsApp",
        description: "Este paciente no tiene número de WhatsApp cargado",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  // Genera el link mostrando estado; devuelve null si falló (ya avisó por toast)
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

  const handleSendMessage = async (messageType: keyof typeof WHATSAPP_MESSAGES) => {
    if (!requirePhone()) return;
    const firstName = patientName.split(" ")[0];
    let message = WHATSAPP_MESSAGES[messageType](firstName);

    // Los avisos incluyen el link de pago cuando el consultorio cobra online
    if (getPaymentLink) {
      const link = await resolveLink();
      if (!link) return;
      message = messageType === "payment_link"
        ? `${message}\n${link}\n¡Gracias!`
        : `${message}\n\nPodés abonarlo online acá: ${link}`;
    } else if (messageType === "payment_link") {
      return;
    }

    openWhatsApp(patientPhone!, message);
  };

  const handleCopyLink = async () => {
    const link = await resolveLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast({ title: "Link de pago copiado", description: "Pegalo donde quieras compartirlo." });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Enviar aviso por WhatsApp"
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {getPaymentLink && (
          <>
            <DropdownMenuItem onClick={() => handleSendMessage("payment_link")} className="gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Enviar link de pago
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
              <Copy className="h-4 w-4" />
              Copiar link de pago
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => handleSendMessage("expires_soon_10")}>
          Avisar: se vence en menos de 10 días
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSendMessage("expires_soon")}>
          Avisar: se vence pronto
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSendMessage("overdue")}>
          Avisar: pago vencido
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

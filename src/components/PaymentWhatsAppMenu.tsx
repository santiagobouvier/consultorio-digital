import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

interface PaymentWhatsAppMenuProps {
  patientPhone: string | null;
  patientName: string;
}

const WHATSAPP_MESSAGES = {
  expires_soon_10: (name: string) =>
    `Hola ${name}, ¿cómo estás? Te escribo para avisarte que en menos de 10 días vence tu próximo pago de consulta. Cualquier cosa que necesites, estoy a las órdenes.`,
  expires_soon: (name: string) =>
    `Hola ${name}, ¿cómo estás? Solo un recordatorio amable de que está por vencer tu pago de consulta. Si ya lo realizaste, podés ignorar este mensaje. ¡Gracias!`,
  overdue: (name: string) =>
    `Hola ${name}, ¿cómo estás? El sistema me notificó que pasó la fecha de tu pago de consulta. Cualquier cosa avisame y coordinamos, gracias.`,
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
}: PaymentWhatsAppMenuProps) {
  const handleSendMessage = (messageType: keyof typeof WHATSAPP_MESSAGES) => {
    if (!patientPhone) {
      toast({
        title: "Sin número de WhatsApp",
        description: "Este paciente no tiene número de WhatsApp cargado",
        variant: "destructive",
      });
      return;
    }

    const firstName = patientName.split(" ")[0];
    const message = WHATSAPP_MESSAGES[messageType](firstName);
    openWhatsApp(patientPhone, message);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title="Enviar aviso por WhatsApp"
        >
          <MessageCircle className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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

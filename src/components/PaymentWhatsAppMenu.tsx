import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, ChevronDown, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { openWhatsApp } from "@/lib/whatsapp";

interface BankAccount {
  id: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  currency: string;
  notes: string | null;
}

interface PaymentWhatsAppMenuProps {
  patientPhone: string | null;
  patientName: string;
  /**
   * Si está presente, los avisos incluyen el link de cobro dentro del
   * mensaje (el botón de cobro online es aparte: PaymentLinkMenu).
   */
  getPaymentLink?: () => Promise<string>;
  /**
   * Habilita "Enviar datos para transferir": carga las cuentas bancarias del
   * consultorio (Configuración → Pagos) al abrir el menú. Todo por wa.me —
   * WhatsApp del profesional, cero costo de API.
   */
  businessId?: string;
  /** Monto del pago: si está, el mensaje de transferencia lo menciona. */
  amount?: number;
  currency?: string;
}

const WHATSAPP_MESSAGES = {
  expires_soon_10: (name: string) =>
    `Hola ${name}, ¿cómo estás? Te escribo para avisarte que en menos de 10 días vence tu próximo pago de consulta. Cualquier cosa que necesites, estoy a las órdenes.`,
  expires_soon: (name: string) =>
    `Hola ${name}, ¿cómo estás? Solo un recordatorio amable de que está por vencer tu pago de consulta. Si ya lo realizaste, podés ignorar este mensaje. ¡Gracias!`,
  overdue: (name: string) =>
    `Hola ${name}, ¿cómo estás? El sistema me notificó que pasó la fecha de tu pago de consulta. Cualquier cosa avisame y coordinamos, gracias.`,
};

const formatAmount = (amount: number, currency?: string) =>
  `${currency === "USD" ? "US$" : "$"} ${Number(amount).toLocaleString("es-UY")}`;

const accountBlock = (a: BankAccount) =>
  [
    `🏦 ${a.bank_name} — ${a.currency === "USD" ? "dólares" : "pesos"}`,
    `Titular: ${a.account_holder}`,
    `Cuenta: ${a.account_number}`,
    ...(a.notes ? [a.notes] : []),
  ].join("\n");

/**
 * Botón "Avisar": recordatorios de vencimiento por WhatsApp. Cuando el
 * consultorio cobra online, el mensaje lleva el link de pago incluido.
 * Con businessId, además permite mandar los datos de transferencia.
 */
export function PaymentWhatsAppMenu({
  patientPhone,
  patientName,
  getPaymentLink,
  businessId,
  amount,
  currency,
}: PaymentWhatsAppMenuProps) {
  const [busy, setBusy] = useState(false);
  const [accounts, setAccounts] = useState<BankAccount[] | null>(null);

  const requirePhone = () => {
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

  // Se cargan una sola vez, al abrir el menú (no en cada render de la lista)
  const loadAccounts = async () => {
    if (!businessId || accounts !== null) return;
    const { data } = await supabase
      .from("business_bank_accounts")
      .select("id, bank_name, account_holder, account_number, currency, notes")
      .eq("business_id", businessId)
      .order("created_at");
    setAccounts((data as BankAccount[]) || []);
  };

  const handleSendMessage = async (messageType: keyof typeof WHATSAPP_MESSAGES) => {
    if (!requirePhone()) return;

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

    openWhatsApp(patientPhone!, message);
  };

  const handleSendTransferData = (selected: BankAccount[]) => {
    if (!requirePhone()) return;
    const firstName = patientName.split(" ")[0];
    const amountText = amount ? ` (${formatAmount(amount, currency)})` : "";
    const message = [
      `Hola ${firstName}! Te paso los datos para abonar la sesión por transferencia${amountText}:`,
      "",
      selected.map(accountBlock).join("\n\n"),
      "",
      "Cuando la hagas, ¿me mandás el comprobante por acá? ¡Gracias!",
    ].join("\n");
    openWhatsApp(patientPhone!, message);
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void loadAccounts(); }}>
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
      <DropdownMenuContent align="end" className="w-64">
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

        {businessId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Transferencia bancaria
            </DropdownMenuLabel>
            {accounts === null ? (
              <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando cuentas...
              </DropdownMenuItem>
            ) : accounts.length === 0 ? (
              <DropdownMenuItem
                className="gap-2 text-muted-foreground"
                onClick={() =>
                  toast({
                    title: "Sin cuentas cargadas",
                    description: "Cargá tus cuentas bancarias en Configuración → Pagos y aparecen acá.",
                  })
                }
              >
                <Banknote className="h-4 w-4" /> Cargar cuentas primero
              </DropdownMenuItem>
            ) : (
              <>
                {accounts.map((a) => (
                  <DropdownMenuItem key={a.id} className="gap-2" onClick={() => handleSendTransferData([a])}>
                    <Banknote className="h-4 w-4 text-primary" />
                    <span className="truncate">
                      {a.bank_name} · {a.currency === "USD" ? "US$" : "$"}
                    </span>
                  </DropdownMenuItem>
                ))}
                {accounts.length > 1 && (
                  <DropdownMenuItem className="gap-2" onClick={() => handleSendTransferData(accounts)}>
                    <Banknote className="h-4 w-4 text-primary" />
                    Enviar todas las cuentas
                  </DropdownMenuItem>
                )}
              </>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

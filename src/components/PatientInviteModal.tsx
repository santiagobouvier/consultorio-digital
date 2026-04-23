import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Loader2, Link as LinkIcon, MessageCircle, Mail, CheckCircle2 } from "lucide-react";
import { buildShareUrl } from "@/config/app";

interface PatientInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  /** Email actual del paciente, si lo tiene cargado */
  patientEmail?: string | null;
}

const isRealEmail = (email?: string | null): email is string => {
  if (!email) return false;
  if (email.endsWith("@portal.interno")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const PatientInviteModal = ({
  open,
  onOpenChange,
  patientId,
  patientName,
  patientEmail,
}: PatientInviteModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [sentToEmail, setSentToEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailInput, setEmailInput] = useState<string>(isRealEmail(patientEmail) ? patientEmail : "");
  const [emailError, setEmailError] = useState<string | null>(null);

  const needsEmailPrompt = !isRealEmail(patientEmail);

  const generateInvite = async () => {
    setEmailError(null);

    // Si el paciente no tiene email cargado, exigir uno válido en el input
    let overrideEmail: string | undefined;
    if (needsEmailPrompt) {
      const trimmed = emailInput.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setEmailError("Ingresá un correo electrónico válido");
        return;
      }
      overrideEmail = trimmed;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-patient-invite", {
        body: { patientId, overrideEmail },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.message || data.error);

      const link = buildShareUrl(`/portal-paciente/invitacion?token=${data.token}`);
      setInviteLink(link);
      setSentToEmail(data.sentTo || overrideEmail || patientEmail || null);

      toast({
        title: "Invitación enviada",
        description: `Le enviamos un correo a ${data.sentTo || overrideEmail || patientEmail}`,
      });
    } catch (error) {
      console.error("Error generating invite:", error);
      toast({
        title: "No se pudo enviar la invitación",
        description: error instanceof Error ? error.message : "Intentá nuevamente en unos segundos",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({ title: "Link copiado" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Error", description: "No se pudo copiar el link", variant: "destructive" });
    }
  };

  const openWhatsApp = () => {
    if (!inviteLink) return;
    const message = encodeURIComponent(
      `Hola ${patientName}! Te enviamos un correo con la invitación a tu portal del paciente. Si no te llegó, podés acceder con este link directo:\n\n${inviteLink}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleClose = () => {
    setInviteLink(null);
    setSentToEmail(null);
    setCopied(false);
    setEmailError(null);
    setEmailInput(isRealEmail(patientEmail) ? patientEmail : "");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invitar al portal
          </DialogTitle>
          <DialogDescription>
            Le enviaremos un correo a <strong>{patientName}</strong> con su acceso al portal del paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!inviteLink ? (
            <>
              {/* Mostrar input de email si hace falta o solo info si ya lo tiene */}
              {needsEmailPrompt ? (
                <div className="space-y-2">
                  <Label htmlFor="invite-email" className="text-sm">
                    Correo electrónico del paciente
                  </Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="paciente@correo.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    className="rounded-xl"
                    disabled={isLoading}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lo guardaremos en su ficha y le enviaremos la invitación a esa dirección.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl bg-muted/50 px-3 py-2.5 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground">Se enviará a:</span>
                  <span className="text-sm font-medium truncate">{patientEmail}</span>
                </div>
              )}

              <Button
                onClick={generateInvite}
                disabled={isLoading}
                className="w-full rounded-xl"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando invitación...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar invitación por correo
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              {/* Confirmación de envío */}
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Correo enviado correctamente
                    </p>
                    <p className="text-xs text-muted-foreground break-all">
                      A: {sentToEmail}
                    </p>
                  </div>
                </div>
              </div>

              {/* Canal alternativo: link directo */}
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  ¿Querés enviarlo también por otro canal?
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    className="rounded-xl text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    className="shrink-0 rounded-xl"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    onClick={openWhatsApp}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Compartir por WhatsApp
                  </Button>
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <LinkIcon className="mr-2 h-4 w-4" />
                        Copiar link
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                El link expira en 7 días.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

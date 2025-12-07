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
import { toast } from "@/hooks/use-toast";
import { Copy, Check, Loader2, Link, MessageCircle } from "lucide-react";

interface PatientInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
}

export const PatientInviteModal = ({
  open,
  onOpenChange,
  patientId,
  patientName,
}: PatientInviteModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateInvite = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-patient-invite", {
        body: { patientId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const baseUrl = window.location.origin;
      const link = `${baseUrl}/portal-paciente/invitacion?token=${data.token}`;
      setInviteLink(link);

      toast({
        title: "Link generado",
        description: "Copialo y enviáselo al paciente por WhatsApp",
      });
    } catch (error) {
      console.error("Error generating invite:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo generar la invitación",
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
      toast({
        title: "Link copiado",
        description: "Ahora podés pegarlo en WhatsApp",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar el link",
        variant: "destructive",
      });
    }
  };

  const openWhatsApp = () => {
    if (!inviteLink) return;
    const message = encodeURIComponent(
      `Hola! Te invito a acceder a tu portal de paciente. Hacé clic en este link para configurar tu acceso:\n\n${inviteLink}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleClose = () => {
    setInviteLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-primary" />
            Invitar al portal
          </DialogTitle>
          <DialogDescription>
            Generá un link único para que <strong>{patientName}</strong> pueda acceder a su portal del paciente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!inviteLink ? (
            <Button 
              onClick={generateInvite} 
              disabled={isLoading}
              className="w-full rounded-xl"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando link...
                </>
              ) : (
                "Generar link de invitación"
              )}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Copiá este link y enviáselo al paciente por WhatsApp:
                </p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    className="rounded-xl text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyToClipboard}
                    className="shrink-0 rounded-xl"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={openWhatsApp}
                  variant="outline"
                  className="flex-1 rounded-xl"
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Abrir WhatsApp
                </Button>
                <Button 
                  onClick={copyToClipboard}
                  className="flex-1 rounded-xl"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar link
                    </>
                  )}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                El link expira en 7 días. El paciente podrá configurar su contraseña al abrirlo.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

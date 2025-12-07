import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Check, UserPlus, Link } from "lucide-react";

interface ProfessionalInviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessId: string;
  onInviteCreated?: () => void;
}

export function ProfessionalInviteModal({ 
  open, 
  onOpenChange, 
  businessId,
  onInviteCreated 
}: ProfessionalInviteModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Campos requeridos",
        description: "Por favor ingresa nombre y email del profesional.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Error",
          description: "Debes iniciar sesión para invitar profesionales.",
          variant: "destructive",
        });
        return;
      }

      const response = await supabase.functions.invoke("create-professional-invite", {
        body: { name, email, businessId },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (data.error) {
        throw new Error(data.error);
      }

      // Generate the invite link
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/invitar-profesional?token=${data.token}`;
      setInviteLink(link);

      toast({
        title: "Invitación creada",
        description: "Copia el enlace y envíalo al profesional.",
      });

      onInviteCreated?.();
    } catch (error: any) {
      console.error("Error creating invite:", error);
      toast({
        title: "Error",
        description: error.message || "No se pudo crear la invitación.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "Enlace copiado",
        description: "El enlace ha sido copiado al portapapeles.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setInviteLink(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invitar profesional
          </DialogTitle>
          <DialogDescription>
            {inviteLink 
              ? "Copia el enlace y envíalo al profesional por WhatsApp o email."
              : "Ingresa los datos del profesional que deseas invitar al consultorio."
            }
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del profesional</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Juan Pérez"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email del profesional</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
                disabled={loading}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creando..." : "Crear invitación"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Enlace de invitación</Label>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-muted rounded-md text-sm break-all font-mono">
                  {inviteLink}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cerrar
              </Button>
              <Button onClick={copyToClipboard} className="gap-2">
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copiar enlace
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

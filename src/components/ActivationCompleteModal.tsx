import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, MessageCircle, PartyPopper } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  businessId: string;
  open: boolean;
  onClose: () => void;
}

const storageKey = (id: string) => `activation_celebrated_${id}`;

export const wasActivationCelebrated = (businessId: string) => {
  try {
    return !!localStorage.getItem(storageKey(businessId));
  } catch {
    return false;
  }
};

export const markActivationCelebrated = (businessId: string) => {
  try {
    localStorage.setItem(storageKey(businessId), new Date().toISOString());
  } catch {
    // ignore
  }
};

export const ActivationCompleteModal = ({ businessId, open, onClose }: Props) => {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase
      .from("businesses")
      .select("public_slug")
      .eq("id", businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSlug(data?.public_slug ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, businessId]);

  const publicUrl = slug ? `${window.location.origin}/consultorio/${slug}` : null;

  const handleCopy = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: "Link copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const handleWhatsapp = () => {
    if (!publicUrl) return;
    const text = encodeURIComponent(
      `Hola, ya podés reservar tu consulta acá: ${publicUrl}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleClose = () => {
    markActivationCelebrated(businessId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <PartyPopper className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">¡Tu consultorio está listo!</DialogTitle>
          <DialogDescription className="text-center">
            Compartí tu link para empezar a recibir reservas.
          </DialogDescription>
        </DialogHeader>

        {publicUrl && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm break-all text-center">
            {publicUrl}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={!publicUrl}
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={!publicUrl}
            onClick={handleWhatsapp}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </Button>
        </div>

        <DialogFooter>
          <Button className="w-full" onClick={handleClose}>
            Ir al dashboard
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActivationCompleteModal;
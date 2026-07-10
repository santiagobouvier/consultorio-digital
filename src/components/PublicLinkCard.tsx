// Tarjeta fija para que el profesional tenga SIEMPRE a mano el link de su web
// pública (reservas): copiar, abrir y compartir por WhatsApp.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Globe, Copy, ExternalLink, MessageCircle } from "lucide-react";

export function PublicLinkCard({ businessId }: { businessId: string }) {
  const { toast } = useToast();
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("businesses")
      .select("public_slug")
      .eq("id", businessId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setSlug(data?.public_slug ?? null);
      });
    return () => { cancelled = true; };
  }, [businessId]);

  if (!slug) return null;

  const url = `${window.location.origin}/consultorio/${slug}`;
  const display = url.replace(/^https?:\/\//, "");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };
  const open = () => window.open(url, "_blank", "noopener");
  const whatsapp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`Reservá tu turno online: ${url}`)}`, "_blank", "noopener");

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10 text-primary">
          <Globe className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Tu web pública</p>
          <p className="text-xs text-muted-foreground mb-2">Compartí este link para que tus pacientes reserven solos.</p>
          <button
            onClick={copy}
            title="Copiar"
            className="block w-full text-left text-xs font-mono text-foreground/80 bg-muted/50 rounded-md px-2.5 py-1.5 truncate hover:bg-muted transition-colors"
          >
            {display}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" onClick={copy} className="gap-1.5">
          <Copy className="w-3.5 h-3.5" /> Copiar
        </Button>
        <Button size="sm" variant="outline" onClick={open} className="gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" /> Abrir
        </Button>
        <Button size="sm" variant="outline" onClick={whatsapp} className="gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-[#25d366]" /> Compartir
        </Button>
      </div>
    </div>
  );
}

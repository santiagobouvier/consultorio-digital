// Kit Web: genera los snippets para incrustar la reserva de un consultorio
// en una web externa con dominio propio (ej: sitios Lovable de clientes).
// Elegís el consultorio → copiás el código → lo pegás en la web del cliente.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildShareUrl } from "@/config/app";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Code2, Copy, Check, Eye, EyeOff, Globe, Users, Loader2, Info } from "lucide-react";

interface BusinessRow {
  id: string;
  name: string;
  public_slug: string | null;
}

/** El script que ajusta el alto del iframe según el contenido (postMessage). */
const buildEmbedSnippet = (slug: string, theme: "light" | "dark") => {
  const src = buildShareUrl(`/embed/${slug}${theme === "dark" ? "?theme=dark" : ""}`);
  return `<!-- Reserva online — Consultorio Digital -->
<div id="cd-reserva" style="width:100%"></div>
<script>
(function () {
  var f = document.createElement("iframe");
  f.src = "${src}";
  f.title = "Reservar turno";
  f.style.width = "100%";
  f.style.border = "0";
  f.style.display = "block";
  f.style.minHeight = "680px";
  f.setAttribute("loading", "lazy");
  f.setAttribute("allowtransparency", "true");
  f.style.background = "transparent";
  document.getElementById("cd-reserva").appendChild(f);
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "cd-embed-height" && e.data.slug === "${slug}") {
      f.style.height = e.data.height + "px";
      f.style.minHeight = "0";
    }
  });
})();
</script>`;
};

const buildPortalSnippet = (slug: string) => {
  const href = buildShareUrl(`/portal/${slug}`);
  return `<!-- Botón "Acceso pacientes" — abre el portal en una pestaña nueva -->
<a href="${href}" target="_blank" rel="noopener"
   style="display:inline-flex;align-items:center;gap:8px;background:#00a396;color:#fff;
          font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px;
          text-decoration:none;font-family:inherit">
  Acceso pacientes
</a>`;
};

export const EmbedKitSection = () => {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // Tema del recuadro: elegí el que combine con la web del cliente
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("businesses")
        .select("id, name, public_slug")
        .order("name");
      if (error) {
        toast({ title: "Error", description: "No se pudieron cargar los consultorios", variant: "destructive" });
      } else {
        setBusinesses((data || []) as BusinessRow[]);
      }
      setLoading(false);
    })();
  }, []);

  const selected = useMemo(
    () => businesses.find((b) => b.id === selectedId) || null,
    [businesses, selectedId],
  );
  const slug = selected?.public_slug || null;

  const embedSnippet = slug ? buildEmbedSnippet(slug, theme) : "";
  const portalSnippet = slug ? buildPortalSnippet(slug) : "";

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast({ title: "Copiado", description: "Pegalo en la web del cliente." });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  const CodeBlock = ({ id, code }: { id: string; code: string }) => (
    <div className="relative">
      <pre className="text-[11px] leading-relaxed bg-black/40 border border-slate-800 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all text-slate-300 max-h-64">
        {code}
      </pre>
      <Button
        size="sm"
        className="absolute top-2.5 right-2.5 h-8 rounded-lg gap-1.5"
        onClick={() => copy(id, code)}
      >
        {copied === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied === id ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2.5">
          <span className="h-9 w-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Code2 className="h-4.5 w-4.5 text-violet-400" />
          </span>
          Kit Web — reserva embebida
        </h2>
        <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
          Para clientes con web y dominio propios (ej: sitios Lovable): elegí el consultorio, copiá el
          código y pegalo en su página. La reserva aparece incrustada con su marca, se ajusta sola de
          alto, y el pago con Mercado Pago se abre fuera del recuadro.
        </p>
      </div>

      {/* Selector de consultorio */}
      <Card className="rounded-2xl bg-slate-900/60 border-slate-800">
        <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Consultorio</p>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full sm:w-[340px] rounded-xl bg-slate-950/60 border-slate-700">
                  <SelectValue placeholder="Elegí un consultorio..." />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id} disabled={!b.public_slug}>
                      {b.name}
                      {!b.public_slug && " (sin link público)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {slug && (
                <Badge variant="outline" className="text-[11px] border-slate-700 text-slate-300 gap-1.5">
                  <Globe className="h-3 w-3" /> {buildShareUrl(`/consultorio/${slug}`)}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selected && slug && (
        <>
          {/* 1. Reserva embebida */}
          <Card className="rounded-2xl bg-slate-900/60 border-slate-800">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-bold text-sm flex items-center gap-2">
                    <Globe className="h-4 w-4 text-violet-400" /> 1 · Reserva incrustada
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Pegá esto donde quieras: es un cuerpo puro sin encabezado ni fondo — se funde con la web del cliente y se ajusta solo de alto. Poné el título de la sección en la web (ej: "Agendá tu hora").
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg bg-slate-950/60 border border-slate-700 p-1">
                    {(["light", "dark"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                          theme === t ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {t === "light" ? "Claro" : "Oscuro"}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg gap-1.5 border-slate-700"
                    onClick={() => setShowPreview((v) => !v)}
                  >
                    {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPreview ? "Ocultar vista previa" : "Vista previa"}
                  </Button>
                </div>
              </div>
              <CodeBlock id="embed" code={embedSnippet} />
              {showPreview && (
                <div className="rounded-xl border border-slate-700 overflow-hidden bg-white">
                  <iframe
                    src={`${window.location.origin}/embed/${slug}${theme === "dark" ? "?theme=dark" : ""}`}
                    title="Vista previa de la reserva"
                    className="w-full border-0"
                    style={{ height: 640, background: theme === "dark" ? "#0d1615" : "#ffffff" }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Botón acceso pacientes */}
          <Card className="rounded-2xl bg-slate-900/60 border-slate-800">
            <CardContent className="p-5 space-y-3">
              <div>
                <p className="font-bold text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-violet-400" /> 2 · Botón "Acceso pacientes"
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Abre el portal del paciente en una pestaña nueva (el portal no va incrustado: ahí hay login).
                </p>
              </div>
              <CodeBlock id="portal" code={portalSnippet} />
            </CardContent>
          </Card>

          {/* Instrucciones Lovable */}
          <Card className="rounded-2xl bg-violet-500/[0.06] border-violet-500/25">
            <CardContent className="p-5">
              <p className="font-bold text-sm flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-violet-400" /> Cómo pegarlo en un sitio Lovable
              </p>
              <ol className="text-xs text-slate-300 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>En el proyecto Lovable del cliente, pedile al chat: <i>"Agregá esta sección de reservas con este código HTML exacto, sin modificarlo"</i> y pegá el snippet 1.</li>
                <li>Repetí con el snippet 2 donde quieras el botón de pacientes (header o footer).</li>
                <li>Conectá el dominio del cliente en la configuración del proyecto Lovable.</li>
                <li>Probá una reserva de punta a punta desde el dominio del cliente.</li>
              </ol>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default EmbedKitSection;

import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import consultorioLogo from "@/assets/logo-loading.png";

// Marco tipográfico simple para los documentos legales de Consultorio Digital.
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto max-w-3xl px-4 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "hsl(180 12% 10%)" }}>
              <img src={consultorioLogo} alt="Consultorio Digital" className="h-6 w-6 object-contain" />
            </span>
            <span className="text-sm font-semibold">Consultorio Digital</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10">Última actualización: {updated}</p>
        <div className="space-y-8 leading-relaxed text-[15px] [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_p]:text-muted-foreground [&_p]:mb-3 [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:text-foreground">
          {children}
        </div>
        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-sm text-muted-foreground">
          <Link to="/terminos" className="hover:text-foreground transition-colors">Términos y Condiciones</Link>
          <Link to="/privacidad" className="hover:text-foreground transition-colors">Política de Privacidad</Link>
        </div>
      </main>
    </div>
  );
}

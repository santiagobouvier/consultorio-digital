import { useMemo, useState } from "react";
import { ExternalLink, Info, RotateCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BLOCKED_REASONS,
  BROWSER_LABELS,
  PLATFORM_BROWSERS,
  PLATFORM_LABELS,
  detectHelpPlatform,
  getBlockedGuide,
  normalizeBrowser,
  type HelpBrowser,
  type HelpPlatform,
} from "@/lib/notification-help";
import { HelpIllustration } from "./HelpIllustration";

interface BlockedNotificationsGuideProps {
  open: boolean;
  onClose: () => void;
}

const PLATFORMS: HelpPlatform[] = ["android", "iphone", "mac", "windows"];

/**
 * Guía paso a paso para volver a permitir las notificaciones cuando el
 * navegador o el sistema las tiene bloqueadas. Solo explica: nunca pide el
 * permiso por su cuenta (eso lo hace el botón "Activar notificaciones").
 */
export function BlockedNotificationsGuide({ open, onClose }: BlockedNotificationsGuideProps) {
  const detected = useMemo(
    () => detectHelpPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints }),
    [],
  );
  const [platform, setPlatform] = useState<HelpPlatform>(detected.platform);
  const [browser, setBrowser] = useState<HelpBrowser>(detected.browser);
  const effectiveBrowser = normalizeBrowser(platform, browser);
  const guide = getBlockedGuide(platform, effectiveBrowser);
  const browsers = PLATFORM_BROWSERS[platform];

  const choosePlatform = (p: HelpPlatform) => {
    setPlatform(p);
    setBrowser(p === detected.platform ? detected.browser : PLATFORM_BROWSERS[p][0]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-2xl flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:w-[calc(100%-2rem)] sm:rounded-2xl"
        data-testid="blocked-notifications-guide"
      >
        <DialogHeader className="shrink-0 space-y-1.5 border-b border-border/60 px-5 pb-3 pt-5 text-left">
          <DialogTitle className="text-lg font-bold sm:text-xl">Cómo habilitar las notificaciones</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Están bloqueadas en este dispositivo. Se habilitan en un par de minutos.
          </DialogDescription>
          <p className="text-xs leading-relaxed text-muted-foreground">{BLOCKED_REASONS}</p>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Plataforma (sugerida automáticamente; se puede cambiar) */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tu dispositivo</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Tu dispositivo">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={platform === p}
                  onClick={() => choosePlatform(p)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    platform === p ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  {PLATFORM_LABELS[p]}
                  {p === detected.platform && <span className="block text-[10px] font-normal text-muted-foreground">este dispositivo</span>}
                </button>
              ))}
            </div>
            {browsers.length > 1 && (
              <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label="Tu navegador">
                {browsers.map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={effectiveBrowser === b}
                    onClick={() => setBrowser(b)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      effectiveBrowser === b ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    {BROWSER_LABELS[b]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {guide.requirements && (
            <div className="flex gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3" data-testid="guide-requirements">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <ul className="space-y-1 text-sm leading-relaxed">
                {guide.requirements.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {guide.sections.map((section) => (
            <section key={section.id} className="space-y-3" data-testid={`guide-section-${section.id}`}>
              <div>
                <h3 className="text-base font-semibold">{section.heading}</h3>
                {section.intro && <p className="mt-0.5 text-sm text-muted-foreground">{section.intro}</p>}
              </div>
              <ol className="space-y-4">
                {section.steps.map((step, i) => (
                  <li key={i} className={cn("grid gap-3", step.illustration && "sm:grid-cols-[1fr_220px] sm:items-start")}>
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium leading-snug">{step.title}</p>
                        {step.path && (
                          <p className="flex flex-wrap items-center gap-1 text-xs" aria-label={step.path.join(", luego ")}>
                            {step.path.map((label, j) => (
                              <span key={j} className="inline-flex items-center gap-1">
                                {j > 0 && <span className="text-muted-foreground">›</span>}
                                <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">{label}</span>
                              </span>
                            ))}
                          </p>
                        )}
                        {step.detail && <p className="text-xs leading-relaxed text-muted-foreground">{step.detail}</p>}
                      </div>
                    </div>
                    {step.illustration && <HelpIllustration illustration={step.illustration} />}
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <div className="rounded-xl border bg-muted/40 p-3 text-sm leading-relaxed" data-testid="guide-finish">
            <p className="font-medium">Por último</p>
            <p className="text-muted-foreground">{guide.finish}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Si en la configuración dice que lo administra tu organización, hay que pedirlo a quien administra el equipo.
            </p>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium">Ayuda oficial</summary>
            <ul className="mt-2 space-y-1.5">
              {guide.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
                    {s.label} <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2">Los dibujos son ilustraciones simplificadas, no capturas de pantalla. Los nombres de los menús pueden variar un poco según la versión.</p>
          </details>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 px-5 py-3 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => window.location.reload()} className="gap-2">
            <RotateCw className="h-4 w-4" aria-hidden /> Ya lo cambié, recargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

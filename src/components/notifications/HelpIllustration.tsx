import { Bell, ChevronRight, Info, Lock } from "lucide-react";
import type { StepIllustration } from "@/lib/notification-help";
import { cn } from "@/lib/utils";

/**
 * Diagrama simplificado de un paso. NO es una captura de pantalla: siempre
 * lleva la etiqueta "Ilustración" y no imita la apariencia exacta de cada
 * sistema (los colores y formas son los de la app).
 */
export function HelpIllustration({ illustration }: { illustration: StepIllustration }) {
  return (
    <figure
      className="relative mx-auto w-full max-w-[260px] select-none"
      aria-label="Ilustración del paso (no es una captura de pantalla)"
      data-testid="help-illustration"
    >
      <span className="absolute -top-2 right-2 z-10 rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
        Ilustración
      </span>
      {illustration.kind === "address-bar" && <AddressBar {...illustration} />}
      {illustration.kind === "settings" && <SettingsList {...illustration} />}
      {illustration.kind === "home-screen" && <HomeScreen appLabel={illustration.appLabel} />}
    </figure>
  );
}

const Frame = ({ device, children }: { device: "desktop" | "phone"; children: React.ReactNode }) => (
  <div
    className={cn(
      "overflow-hidden border bg-card shadow-sm",
      device === "phone" ? "rounded-[22px] border-[3px] px-2 pb-3 pt-4" : "rounded-xl",
    )}
  >
    {device === "desktop" && (
      <div className="flex items-center gap-1 border-b bg-muted/50 px-2 py-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
      </div>
    )}
    {children}
  </div>
);

const Toggle = ({ on = true }: { on?: boolean }) => (
  <span className={cn("relative inline-flex h-4 w-7 shrink-0 rounded-full", on ? "bg-primary" : "bg-muted-foreground/30")}>
    <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-background shadow", on ? "left-3.5" : "left-0.5")} />
  </span>
);

const currentHost = () => (typeof window !== "undefined" && window.location.host) || "esta página";

function AddressBar({ device, panelTitle, rowLabel, value }: Extract<StepIllustration, { kind: "address-bar" }>) {
  return (
    <Frame device={device}>
      <div className="p-2">
        <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-1">
          <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary ring-2 ring-primary">
            <Lock className="h-3 w-3" aria-hidden />
          </span>
          <span className="truncate text-[11px] text-muted-foreground">{currentHost()}</span>
        </div>
        <div className="ml-2 mt-1 h-2 w-2 rotate-45 border-l border-t bg-popover" />
        <div className="-mt-1 rounded-lg border bg-popover p-2 shadow-md">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
            <Info className="h-3 w-3" aria-hidden /> {panelTitle}
          </p>
          <div className="flex items-center justify-between rounded-md bg-primary/10 px-2 py-1.5 ring-1 ring-primary/50">
            <span className="flex items-center gap-1.5 text-[11px] font-medium">
              <Bell className="h-3 w-3" aria-hidden /> {rowLabel}
            </span>
            {value === "toggle" ? <Toggle /> : <span className="text-[10px] font-semibold text-primary">{value}</span>}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function SettingsList({ device, title, breadcrumb, rows }: Extract<StepIllustration, { kind: "settings" }>) {
  return (
    <Frame device={device}>
      <div className="space-y-1.5 p-2">
        <p className="text-[11px] font-semibold">{title}</p>
        {breadcrumb && <p className="text-[10px] text-muted-foreground">{breadcrumb}</p>}
        <div className="divide-y rounded-lg border bg-background">
          {rows.map((r) => (
            <div
              key={r.label}
              className={cn("flex items-center justify-between px-2 py-1.5", r.highlight && "bg-primary/10 ring-1 ring-inset ring-primary/50")}
            >
              <span className={cn("truncate text-[11px]", r.highlight ? "font-semibold" : "text-muted-foreground")}>{r.label}</span>
              {r.control === "toggle" && <Toggle on={!!r.highlight || undefined} />}
              {r.control === "chevron" && <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />}
              {r.control === "allow" && (
                <span className={cn("rounded border px-1.5 text-[10px]", r.highlight ? "border-primary text-primary" : "text-muted-foreground")}>
                  {r.highlight ? "Permitir" : "Denegar"}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function HomeScreen({ appLabel }: { appLabel: string }) {
  return (
    <Frame device="phone">
      <div className="grid grid-cols-4 gap-2 p-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="aspect-square rounded-lg bg-muted" />
        ))}
        <span className="flex flex-col items-center gap-0.5">
          <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-card">
            CD
          </span>
          <span className="truncate text-[8px] text-muted-foreground">{appLabel}</span>
        </span>
      </div>
    </Frame>
  );
}

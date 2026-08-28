import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Copy, Eye, Menu, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

// Tutorial visual para sacar la "Dirección secreta en formato iCal" de
// Google Calendar. Las "capturas" son recreaciones dibujadas de las
// pantallas de Google (siempre en claro, como se ven allá), con el lugar
// a tocar marcado en rojo. Pop-up sobre pop-up: se abre desde la sección
// opcional del CalendarSyncButton.

interface GoogleLinkTutorialProps {
  open: boolean;
  onClose: () => void;
}

/** Marco común de cada "captura": tarjeta blanca estilo Google. */
const Shot = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-zinc-200 bg-white text-zinc-700 p-3.5 shadow-sm select-none">
    {children}
  </div>
);

/** Círculo rojo de "tocá acá". */
const Target = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("relative inline-flex rounded-lg ring-2 ring-rose-500 ring-offset-2 ring-offset-white", className)}>
    {children}
    <span className="absolute -top-2 -right-2 flex h-4 w-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500" />
    </span>
  </span>
);

const STEPS = [
  {
    title: "Abrí la configuración de Google Calendar",
    caption: "Desde la compu, en Google Calendar, tocá la ruedita de arriba a la derecha. (O usá el botón de acá abajo, que te lleva directo.)",
    shot: (
      <Shot>
        {/* Barra superior de Google Calendar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Menu className="h-4 w-4 text-zinc-500" />
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-white text-[10px] font-bold">27</span>
            <span className="text-[15px] font-medium text-zinc-800">Calendario</span>
            <span className="ml-2 rounded-full border border-zinc-300 px-2.5 py-0.5 text-[11px]">Hoy</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Search className="h-4 w-4 text-zinc-500" />
            <Target>
              <Settings className="h-5 w-5 text-zinc-600 m-0.5" />
            </Target>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-white text-[10px] font-bold">S</span>
          </div>
        </div>
        <div className="mt-2.5 rounded-lg bg-zinc-50 border border-zinc-200 px-3 py-2 text-[12px] text-zinc-500">
          … y en el menú que se abre, tocá <span className="font-semibold text-zinc-700">"Configuración"</span>
        </div>
      </Shot>
    ),
  },
  {
    title: "Tocá el calendario con TU nombre",
    caption: "En la columna izquierda, bajá hasta \"Configuración de mis calendarios\" y tocá el que tiene tu nombre.",
    shot: (
      <Shot>
        <p className="text-[11px] font-medium text-zinc-500 mb-2">Configuración de mis calendarios</p>
        <div className="space-y-1.5">
          <Target className="w-full">
            <span className="flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[13px] font-medium text-zinc-800">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-600" />
              Tu nombre
            </span>
          </Target>
          <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-500">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" />
            Cumpleaños
          </div>
          <div className="flex items-center gap-2 px-3 py-2 text-[13px] text-zinc-500">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
            Tasks
          </div>
        </div>
      </Shot>
    ),
  },
  {
    title: "Bajá hasta \"Integrar el calendario\"",
    caption: "Se abre la configuración de tu calendario. Bajá (o tocá en el índice de la izquierda) hasta la sección \"Integrar el calendario\".",
    shot: (
      <Shot>
        <div className="space-y-1">
          {["Notificaciones de eventos", "Otras notificaciones"].map((t) => (
            <p key={t} className="px-3 py-1.5 text-[13px] text-zinc-500">{t}</p>
          ))}
          <Target className="w-full">
            <span className="block w-full rounded-lg bg-blue-50 px-3 py-1.5 text-[13px] font-medium text-zinc-800">
              Integrar el calendario
            </span>
          </Target>
          <p className="px-3 py-1.5 text-[13px] text-zinc-500">Eliminar el calendario</p>
        </div>
      </Shot>
    ),
  },
  {
    title: "Copiá la Dirección SECRETA en formato iCal",
    caption: "Es la última de la sección, la que está tapada con puntitos. Tocá el iconito de copiar y pegala en la agenda. ¡Ojo: la SECRETA, no la pública!",
    shot: (
      <Shot>
        <div className="space-y-2.5">
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 opacity-50">
            <p className="text-[10px] text-zinc-500">Dirección pública en formato iCal</p>
            <p className="text-[11px] text-zinc-600 truncate">https://calendar.google.com/.../public/basic.ics</p>
            <p className="text-[10px] text-rose-500 font-semibold mt-0.5">✗ Esta NO</p>
          </div>
          <div className="rounded-lg border border-zinc-300 bg-white px-3 py-2 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500">Dirección secreta en formato iCal</p>
              <p className="text-[13px] tracking-widest text-zinc-700">••••••••••</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Eye className="h-4 w-4 text-zinc-500" />
              <Target>
                <Copy className="h-4 w-4 text-zinc-600 m-1" />
              </Target>
            </div>
          </div>
        </div>
      </Shot>
    ),
  },
] as const;

export const GoogleLinkTutorial = ({ open, onClose }: GoogleLinkTutorialProps) => {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;
  const s = STEPS[step];

  const handleClose = () => {
    onClose();
    setStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[88dvh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-border/60">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            Paso {step + 1} de {STEPS.length}
          </p>
          <DialogTitle className="text-base font-bold leading-tight mt-0.5">
            {s.title}
          </DialogTitle>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {s.shot}
          <p className="text-[13px] leading-snug text-muted-foreground">{s.caption}</p>
          {step === 0 && (
            <Button asChild variant="outline" size="sm" className="rounded-xl h-10 w-full">
              <a
                href="https://calendar.google.com/calendar/u/0/r/settings"
                target="_blank"
                rel="noreferrer"
              >
                Abrir la configuración de Google Calendar
              </a>
            </Button>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-border/60 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => setStep((v) => Math.max(0, v - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <Button
            size="sm"
            className="rounded-xl font-semibold"
            onClick={() => (last ? handleClose() : setStep((v) => v + 1))}
          >
            {last ? "¡Listo!" : "Siguiente"}
            {!last && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

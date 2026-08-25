import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Filter, Download, Share2, CalendarCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as MiniCalendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";
import { ViewType } from "./types";
import { HelpTooltip } from "@/components/HelpTooltip";
import { NewActionDialog } from "./NewActionDialog";

interface CalendarHeaderProps {
  currentDate: Date;
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
  onAddAppointment: () => void;
  onAddPayment?: () => void;
  onAddPersonal?: () => void;
  onQuickBlock?: () => void;
  onOpenSlot?: () => void;
  onShareSlots?: () => void;
  /** Editar la semana tipo sin salir de la agenda ("Mis horarios"). */
  onOpenSchedule?: () => void;
  /** Tocar el título abre un mini-mes para saltar a cualquier fecha. */
  onPickDate?: (date: Date) => void;
  /** Acciones extra (ej: Referencias) integradas al cluster de íconos. */
  extraActions?: React.ReactNode;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  dateLabel: string;
  onExportCSV?: () => void;
}

const TitleWithMiniMonth = ({
  dateLabel,
  currentDate,
  onPickDate,
  className,
}: {
  dateLabel: string;
  currentDate: Date;
  onPickDate?: (d: Date) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const title = (
    <h1 className={className}>
      {dateLabel}
    </h1>
  );
  if (!onPickDate) return title;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 min-w-0 text-left" aria-label="Elegir fecha">
          {title}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1 rounded-2xl shadow-xl">
        <MiniCalendar
          mode="single"
          locale={es}
          selected={currentDate}
          defaultMonth={currentDate}
          onSelect={(d) => {
            if (!d) return;
            onPickDate(d);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export const CalendarHeader = ({
  currentDate,
  viewType,
  onViewChange,
  onNavigate,
  onToday,
  onAddAppointment,
  onAddPayment,
  onAddPersonal,
  onQuickBlock,
  onOpenSlot,
  onShareSlots,
  onOpenSchedule,
  onPickDate,
  extraActions,
  onToggleFilters,
  hasActiveFilters,
  activeFiltersCount,
  dateLabel,
  onExportCSV,
}: CalendarHeaderProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  // "+ Nuevo": abre el selector de tarjetas grandes si hay más de una opción
  const hasPicker = !!(onAddPayment || onAddPersonal || onQuickBlock);
  const AddMenu = ({ triggerClassName, iconOnly = false }: { triggerClassName?: string; iconOnly?: boolean }) => {
    if (!hasPicker) {
      return (
        <Button onClick={onAddAppointment} className={triggerClassName} size={iconOnly ? "icon" : "default"}>
          <Plus className={iconOnly ? "h-5 w-5" : "h-4 w-4"} />
          {!iconOnly && <span className="ml-2">Nueva cita</span>}
        </Button>
      );
    }
    return (
      <Button onClick={() => setPickerOpen(true)} className={triggerClassName} size={iconOnly ? "icon" : "default"}>
        <Plus className={iconOnly ? "h-5 w-5" : "h-4 w-4"} />
        {!iconOnly && <span className="ml-2">Nuevo</span>}
      </Button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Mobile Header: título grande + cluster de acciones glass +
          píldora de navegación ‹ Hoy › + tabs redondeados. Compacto y
          premium: dos filas en vez de tres. */}
      <div className="md:hidden space-y-3">
        {/* Fila 1: título del período + acciones */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-0.5 flex items-center gap-2">
            <TitleWithMiniMonth
              dateLabel={dateLabel}
              currentDate={currentDate}
              onPickDate={onPickDate}
              className="text-[22px] leading-[1.1] font-bold tracking-tight capitalize truncate"
            />
            <HelpTooltip id="agenda" />
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {extraActions}
            {onOpenSchedule && (
              <button
                onClick={onOpenSchedule}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/70 transition-colors active:bg-muted hover:text-foreground"
                aria-label="Mis horarios"
              >
                <CalendarCog className="h-[17px] w-[17px]" strokeWidth={1.8} />
              </button>
            )}
            {onShareSlots && (
              <button
                onClick={onShareSlots}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/70 transition-colors active:bg-muted hover:text-foreground"
                aria-label="Compartir huecos libres"
              >
                <Share2 className="h-[17px] w-[17px]" strokeWidth={1.8} />
              </button>
            )}
            <button
              onClick={onToggleFilters}
              className={cn(
                "relative h-9 w-9 rounded-full flex items-center justify-center transition-colors active:bg-muted",
                hasActiveFilters ? "text-primary" : "text-muted-foreground/70 hover:text-foreground"
              )}
              aria-label="Filtros"
            >
              <Filter className="h-[17px] w-[17px]" strokeWidth={1.8} />
              {hasActiveFilters && (
                <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground rounded-full text-[8px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Fila 2: píldora ‹ Hoy › + tabs, sin bordes: solo superficies */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full bg-muted/50 overflow-hidden shrink-0">
            <button
              onClick={() => onNavigate("prev")}
              className="h-9 w-9 flex items-center justify-center text-muted-foreground/80 transition-colors active:bg-muted hover:text-foreground"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              onClick={onToday}
              className="h-9 px-2.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-primary transition-colors active:bg-primary/10"
            >
              Hoy
            </button>
            <button
              onClick={() => onNavigate("next")}
              className="h-9 w-9 flex items-center justify-center text-muted-foreground/80 transition-colors active:bg-muted hover:text-foreground"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <Tabs
            value={viewType}
            onValueChange={(v) => onViewChange(v as ViewType)}
            className="flex-1 min-w-0"
          >
            <TabsList className="w-full h-9 rounded-full bg-muted/50 p-0.5">
              <TabsTrigger
                value="day"
                className="flex-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm h-8 text-[12.5px] font-semibold"
              >
                Día
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="flex-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm h-8 text-[12.5px] font-semibold"
              >
                Semana
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="flex-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm h-8 text-[12.5px] font-semibold"
              >
                Mes
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Desktop/tablet Header: en tablet los controles bajan a una segunda
          fila (flex-wrap) en vez de estrujar la fecha en vertical */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Date Navigation */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("prev")}
              className="h-9 w-9 rounded-xl"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavigate("next")}
              className="h-9 w-9 rounded-xl"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Date Display */}
          <div className="min-w-0 flex items-center gap-2">
            <TitleWithMiniMonth
              dateLabel={dateLabel}
              currentDate={currentDate}
              onPickDate={onPickDate}
              className="text-xl font-bold capitalize whitespace-nowrap"
            />
            <HelpTooltip id="agenda" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="rounded-xl shrink-0"
          >
            Hoy
          </Button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* View Tabs */}
          <Tabs value={viewType} onValueChange={(v) => onViewChange(v as ViewType)}>
            <TabsList className="h-10 rounded-xl">
              <TabsTrigger value="day" className="rounded-lg px-4">Día</TabsTrigger>
              <TabsTrigger value="week" className="rounded-lg px-4">Semana</TabsTrigger>
              <TabsTrigger value="month" className="rounded-lg px-4">Mes</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={onToggleFilters}
            className="rounded-xl gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 rounded-full text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>

          {/* Mis horarios: la semana tipo sin salir de la agenda */}
          {onOpenSchedule && (
            <Button variant="outline" size="sm" onClick={onOpenSchedule} className="rounded-xl gap-2">
              <CalendarCog className="h-4 w-4" />
              Mis horarios
            </Button>
          )}

          {/* Compartir huecos libres */}
          {onShareSlots && (
            <Button variant="outline" size="sm" onClick={onShareSlots} className="rounded-xl gap-2">
              <Share2 className="h-4 w-4" />
              Compartir huecos
            </Button>
          )}

          {/* Export */}
          {onExportCSV && (
            <Button variant="outline" size="sm" onClick={onExportCSV} className="rounded-xl gap-2">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          )}

          {/* Add Button */}
          <AddMenu triggerClassName="rounded-xl gap-2" />

        </div>
      </div>

      {hasPicker && (
        <NewActionDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onAddAppointment={onAddAppointment}
          onAddPayment={onAddPayment}
          onAddPersonal={onAddPersonal}
          onQuickBlock={onQuickBlock}
          onOpenSlot={onOpenSlot}
        />
      )}
    </div>
  );
};

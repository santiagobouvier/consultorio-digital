import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, Filter, Download, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  onShareSlots?: () => void;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  dateLabel: string;
  onExportCSV?: () => void;
}

export const CalendarHeader = ({
  currentDate,
  viewType,
  onViewChange,
  onNavigate,
  onToday,
  onAddAppointment,
  onAddPayment,
  onAddPersonal,
  onShareSlots,
  onToggleFilters,
  hasActiveFilters,
  activeFiltersCount,
  dateLabel,
  onExportCSV,
}: CalendarHeaderProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  // "+ Nuevo": abre el selector de dos tarjetas grandes (cita / pago).
  const AddMenu = ({ triggerClassName, iconOnly = false }: { triggerClassName?: string; iconOnly?: boolean }) => {
    if (!onAddPayment) {
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
            <h1 className="text-[26px] leading-[1.1] font-extrabold tracking-tight capitalize bg-gradient-to-br from-foreground via-foreground to-foreground/55 bg-clip-text text-transparent truncate">
              {dateLabel}
            </h1>
            <HelpTooltip id="agenda" />
          </div>
          <div className="flex items-center gap-0.5 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md p-1 shadow-sm shrink-0">
            {onShareSlots && (
              <button
                onClick={onShareSlots}
                className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground transition-colors active:bg-muted hover:text-foreground"
                aria-label="Compartir huecos libres"
              >
                <Share2 className="h-[18px] w-[18px]" />
              </button>
            )}
            <button
              onClick={onToggleFilters}
              className={cn(
                "relative h-9 w-9 rounded-xl flex items-center justify-center transition-colors active:bg-muted",
                hasActiveFilters ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Filtros"
            >
              <Filter className="h-[18px] w-[18px]" />
              {hasActiveFilters && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full text-[9px] font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Fila 2: píldora ‹ Hoy › + tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-border/60 bg-card shadow-sm overflow-hidden shrink-0">
            <button
              onClick={() => onNavigate("prev")}
              className="h-10 w-10 flex items-center justify-center text-muted-foreground transition-colors active:bg-muted hover:text-foreground"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={onToday}
              className="h-10 px-3 text-[11px] font-bold uppercase tracking-[0.12em] text-primary border-x border-border/60 transition-colors active:bg-primary/10"
            >
              Hoy
            </button>
            <button
              onClick={() => onNavigate("next")}
              className="h-10 w-10 flex items-center justify-center text-muted-foreground transition-colors active:bg-muted hover:text-foreground"
              aria-label="Siguiente"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>

          <Tabs
            value={viewType}
            onValueChange={(v) => onViewChange(v as ViewType)}
            className="flex-1 min-w-0"
          >
            <TabsList className="w-full h-10 rounded-full bg-muted/50 border border-border/50 p-1">
              <TabsTrigger
                value="day"
                className="flex-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm h-8 text-[13px] font-semibold"
              >
                Día
              </TabsTrigger>
              <TabsTrigger
                value="week"
                className="flex-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm h-8 text-[13px] font-semibold"
              >
                Semana
              </TabsTrigger>
              <TabsTrigger
                value="month"
                className="flex-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm h-8 text-[13px] font-semibold"
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
          <div className="min-w-0">
            <h1 className="text-xl font-bold capitalize inline-flex items-center gap-2 whitespace-nowrap">
              {dateLabel}
              <HelpTooltip id="agenda" />
            </h1>
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

      {onAddPayment && (
        <NewActionDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onAddAppointment={onAddAppointment}
          onAddPayment={onAddPayment}
          onAddPersonal={onAddPersonal}
        />
      )}
    </div>
  );
};

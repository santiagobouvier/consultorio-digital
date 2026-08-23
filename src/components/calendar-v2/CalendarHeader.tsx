import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, Filter, Download } from "lucide-react";
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
      {/* Mobile Header */}
      <div className="md:hidden space-y-4">
        {/* Top row: Navigation + Add */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onNavigate("prev")}
              className="h-10 w-10 rounded-xl"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onNavigate("next")}
              className="h-10 w-10 rounded-xl"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="icon"
              onClick={onToggleFilters}
              className="h-10 w-10 rounded-xl relative"
            >
              <Filter className="h-5 w-5" />
              {hasActiveFilters && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full text-xs flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            {/* Mobile: '+' moved to floating FAB at the bottom of the page */}
          </div>
        </div>

        {/* Date Display */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold capitalize inline-flex items-center gap-2">
              {dateLabel}
              <HelpTooltip id="agenda" />
            </h1>
            <button
              onClick={onToday}
              className="text-sm text-primary font-medium hover:underline"
            >
              Ir a hoy
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <Tabs value={viewType} onValueChange={(v) => onViewChange(v as ViewType)} className="w-full">
          <TabsList className="w-full h-12 rounded-xl bg-muted/50 p-1">
            <TabsTrigger 
              value="day" 
              className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm h-10 text-sm font-medium"
            >
              Día
            </TabsTrigger>
            <TabsTrigger 
              value="week" 
              className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm h-10 text-sm font-medium"
            >
              Semana
            </TabsTrigger>
            <TabsTrigger 
              value="month" 
              className="flex-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm h-10 text-sm font-medium"
            >
              Mes
            </TabsTrigger>
          </TabsList>
        </Tabs>
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

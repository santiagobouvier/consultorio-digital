import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Plus, Filter } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ViewType } from "./types";
import { cn } from "@/lib/utils";

interface CalendarHeaderProps {
  currentDate: Date;
  viewType: ViewType;
  onViewChange: (view: ViewType) => void;
  onNavigate: (direction: "prev" | "next") => void;
  onToday: () => void;
  onAddAppointment: () => void;
  onToggleFilters: () => void;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  dateLabel: string;
}

export const CalendarHeader = ({
  currentDate,
  viewType,
  onViewChange,
  onNavigate,
  onToday,
  onAddAppointment,
  onToggleFilters,
  hasActiveFilters,
  activeFiltersCount,
  dateLabel,
}: CalendarHeaderProps) => {
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
            <Button
              onClick={onAddAppointment}
              size="icon"
              className="h-10 w-10 rounded-xl"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Date Display */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold capitalize">{dateLabel}</h1>
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

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-1">
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
          <div>
            <h1 className="text-xl font-bold capitalize">{dateLabel}</h1>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="rounded-xl"
          >
            Hoy
          </Button>
        </div>

        <div className="flex items-center gap-3">
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

          {/* Add Button */}
          <Button onClick={onAddAppointment} className="rounded-xl gap-2">
            <Plus className="h-4 w-4" />
            Nueva cita
          </Button>
        </div>
      </div>
    </div>
  );
};

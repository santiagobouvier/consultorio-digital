import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarFilters, AppointmentStatus } from "./types";
import { Search, X } from "lucide-react";
import { useState } from "react";

interface Patient {
  id: string;
  full_name: string;
}

interface CalendarFiltersPanelProps {
  filters: CalendarFilters;
  onFiltersChange: (filters: CalendarFilters) => void;
  patients: Patient[];
  onClear: () => void;
}

export const CalendarFiltersPanel = ({
  filters,
  onFiltersChange,
  patients,
  onClear,
}: CalendarFiltersPanelProps) => {
  const [patientSearch, setPatientSearch] = useState("");

  const filteredPatients = patients.filter((p) =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const hasActiveFilters =
    filters.patientId !== null ||
    filters.status !== "all" ||
    filters.paymentStatus !== "all";

  return (
    <Card className="border-dashed animate-in slide-in-from-top-2 duration-200">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Paciente
            </label>
            <Select
              value={filters.patientId || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  patientId: value === "all" ? null : value,
                })
              }
            >
              <SelectTrigger className="h-11 rounded-xl">
                <Search className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Buscar paciente..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="h-9 rounded-lg"
                  />
                </div>
                <SelectItem value="all">Todos los pacientes</SelectItem>
                {filteredPatients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Estado de cita
            </label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  status: value as AppointmentStatus | "all",
                })
              }
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Programada</SelectItem>
                <SelectItem value="confirmed">Confirmada</SelectItem>
                <SelectItem value="attended">Realizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
                <SelectItem value="no_show">Ausente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment status filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Estado de pago
            </label>
            <Select
              value={filters.paymentStatus}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  paymentStatus: value as CalendarFilters["paymentStatus"],
                })
              }
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="al_dia">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Al día
                  </div>
                </SelectItem>
                <SelectItem value="por_vencer">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Por vencer
                  </div>
                </SelectItem>
                <SelectItem value="vencido">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Vencido
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear button */}
          <div className="flex items-end">
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground gap-2"
                onClick={onClear}
              >
                <X className="h-4 w-4" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

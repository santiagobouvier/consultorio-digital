import { cn } from "@/lib/utils";
import { Professional } from "./types";
import { Users } from "lucide-react";

interface ProfessionalFilterProps {
  professionals: Professional[];
  selectedProfessionalId: string | null;
  onSelect: (professionalId: string | null) => void;
  sharedCalendar: boolean;
}

export const ProfessionalFilter = ({
  professionals,
  selectedProfessionalId,
  onSelect,
  sharedCalendar,
}: ProfessionalFilterProps) => {
  if (!sharedCalendar || professionals.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {/* All professionals */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0",
          selectedProfessionalId === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted/50 text-muted-foreground hover:bg-muted"
        )}
      >
        <Users className="h-4 w-4" />
        Todos
      </button>

      {/* Individual professionals */}
      {professionals.map((prof) => (
        <button
          key={prof.id}
          onClick={() => onSelect(prof.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap shrink-0",
            selectedProfessionalId === prof.id
              ? "bg-card text-foreground shadow-sm border-2"
              : "bg-muted/50 text-muted-foreground hover:bg-muted border border-transparent"
          )}
          style={{
            borderColor: selectedProfessionalId === prof.id ? prof.color : undefined,
          }}
        >
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: prof.color }}
          />
          {prof.name.split(" ")[0]}
        </button>
      ))}
    </div>
  );
};

import { Professional } from "./types";

interface ProfessionalColorLegendProps {
  professionals: Professional[];
}

export const ProfessionalColorLegend = ({ professionals }: ProfessionalColorLegendProps) => {
  if (professionals.length < 2) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap px-1">
      {professionals.map((prof) => (
        <div key={prof.id} className="flex items-center gap-1.5">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: prof.color }}
          />
          <span className="text-xs text-muted-foreground font-medium">
            {prof.name.split(" ")[0]}
          </span>
        </div>
      ))}
    </div>
  );
};

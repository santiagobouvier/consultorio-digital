import { ImageIcon } from "lucide-react";

interface ScreenshotPlaceholderProps {
  accent?: string;
  label?: string;
  aspect?: string;
}

export function ScreenshotPlaceholder({
  accent = "#00c78a",
  label = "Captura próximamente",
  aspect = "16 / 10",
}: ScreenshotPlaceholderProps) {
  return (
    <div
      className="relative rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 flex items-center justify-center"
      style={{
        backgroundColor: "#0f0f0f",
        aspectRatio: aspect,
        boxShadow: `0 25px 70px -20px ${accent}25, 0 10px 30px -10px rgba(0,0,0,0.6)`,
        backgroundImage:
          "linear-gradient(135deg, rgba(255,255,255,0.02) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.02) 75%, transparent 75%)",
        backgroundSize: "20px 20px",
      }}
    >
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accent}15`, color: accent }}
        >
          <ImageIcon className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium tracking-wide">{label}</p>
      </div>
    </div>
  );
}
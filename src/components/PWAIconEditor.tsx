import { useState, useCallback, useRef, useEffect } from "react";
import Cropper, { Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Upload, Building2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Las fotos de cámara/stock pueden medir 4000-6000px: cargarlas enteras al
// recortador infla la memoria de la pestaña hasta tirarla abajo (se veía
// como una página que se recarga en bucle). Para un ícono de 512px alcanza
// con mucho menos: se reescala la imagen ANTES de entrar al editor.
const MAX_SOURCE_DIM = 1600;
const MAX_FILE_MB = 12;

interface PWAIconEditorProps {
  /** URL pública del ícono ya generado (preview tras guardar). */
  iconUrl?: string;
  /** Color HEX de fondo del ícono. */
  bgColor: string;
  onBgColorChange: (hex: string) => void;
  /** Hex sugerido (color primario del consultorio) para el botón "Usar color del consultorio". */
  suggestedBgColor: string;
  /** Se llama cuando hay cambios pendientes que se persistirán al hacer Guardar. */
  onPendingChange: (pending: { sourceImage: string; crop: Area; bgColor: string } | null) => void;
  uploading?: boolean;
}

/**
 * Editor estilo Instagram para el ícono PWA.
 * - El usuario sube una imagen, la encuadra dentro de un círculo (zoom + arrastre).
 * - Elige color de fondo (default = color primario del consultorio).
 * - Al confirmar (botón Guardar del padre), el padre llama a `generatePwaIconBlob`
 *   con los datos `pending` para producir el PNG circular final.
 */
export const PWAIconEditor = ({
  iconUrl,
  bgColor,
  onBgColorChange,
  suggestedBgColor,
  onPendingChange,
  uploading,
}: PWAIconEditorProps) => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // Notificar cambios pendientes al padre
  useEffect(() => {
    if (sourceImage && croppedAreaPixels) {
      onPendingChange({ sourceImage, crop: croppedAreaPixels, bgColor });
    }
  }, [sourceImage, croppedAreaPixels, bgColor, onPendingChange]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Ese archivo no es una imagen", description: "Subí un PNG, JPG o SVG.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: "Imagen demasiado pesada", description: `El máximo es ${MAX_FILE_MB}MB. Probá con una versión más liviana.`, variant: "destructive" });
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = await loadImage(objectUrl);
      const scale = Math.min(1, MAX_SOURCE_DIM / Math.max(img.width, img.height, 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas no disponible");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      setSourceImage(canvas.toDataURL("image/png"));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (e) {
      console.error("[PWAIconEditor] No se pudo procesar la imagen:", e);
      toast({ title: "No pudimos leer esa imagen", description: "Probá con otro archivo (PNG o JPG).", variant: "destructive" });
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    setSourceImage(null);
    setCroppedAreaPixels(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onPendingChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const showEditor = !!sourceImage;

  return (
    <div className="space-y-5">
      {/* Preview + editor */}
      <div className="flex flex-col items-center gap-4">
        {showEditor ? (
          <div
            className="relative w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden border bg-muted"
            style={{ background: bgColor }}
          >
            <Cropper
              image={sourceImage!}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              minZoom={0.5}
              maxZoom={3}
              restrictPosition={false}
              objectFit="contain"
              style={{
                containerStyle: { background: bgColor },
              }}
            />
          </div>
        ) : (
          // Preview "como en el celular" con el ícono ya guardado o placeholder
          <div
            className="w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] rounded-[28%] overflow-hidden flex items-center justify-center shadow-lg"
            style={{ background: bgColor }}
          >
            {iconUrl ? (
              <img src={iconUrl} alt="Ícono PWA" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="h-16 w-16 text-white/80" />
            )}
          </div>
        )}

        {showEditor && (
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Arrastrá la imagen para reposicionarla y usá el zoom para ajustar el encuadre.
          </p>
        )}
      </div>

      {/* Zoom slider */}
      {showEditor && (
        <div className="space-y-2">
          <Label className="text-xs">Zoom</Label>
          <Slider
            value={[zoom]}
            min={0.5}
            max={3}
            step={0.01}
            onValueChange={(v) => setZoom(v[0])}
          />
        </div>
      )}

      {/* Color de fondo */}
      <div className="space-y-2">
        <Label className="text-xs">Color de fondo del ícono</Label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={bgColor}
            onChange={(e) => onBgColorChange(e.target.value)}
            className="h-11 w-12 rounded-lg border border-border cursor-pointer p-1 shrink-0"
          />
          <input
            type="text"
            value={bgColor}
            onChange={(e) => onBgColorChange(e.target.value)}
            className="flex-1 h-11 rounded-md border border-input bg-background px-3 text-sm font-mono"
          />
          {suggestedBgColor.toLowerCase() !== bgColor.toLowerCase() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onBgColorChange(suggestedBgColor)}
              className="shrink-0"
            >
              Usar color del consultorio
            </Button>
          )}
        </div>
      </div>

      {/* Acciones de archivo */}
      <div className="flex flex-wrap gap-2">
        <label className="cursor-pointer">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
            disabled={uploading}
          />
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <span>
              <Upload className="h-4 w-4" />
              {sourceImage ? "Cambiar imagen" : iconUrl ? "Reemplazar ícono" : "Subir logo"}
            </span>
          </Button>
        </label>
        {showEditor && (
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
            Cancelar
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Este ícono es el que ven los pacientes cuando instalan tu consultorio en el celular.
        PNG, JPG o SVG — si la foto es muy grande, la ajustamos solos.
      </p>
    </div>
  );
};

/**
 * Renderiza el ícono final como PNG circular (512x512) con fondo color sólido,
 * usando los datos del editor. Devuelve un Blob listo para subir.
 */
export async function generatePwaIconBlob(
  sourceImage: string,
  cropPixels: Area,
  bgColor: string,
  outputSize = 512
): Promise<Blob> {
  const img = await loadImage(sourceImage);

  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  // Fondo sólido (cuadrado completo — Android lo recortará a maskable)
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, outputSize, outputSize);

  // Dibujar el recorte escalado al tamaño de salida
  ctx.drawImage(
    img,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Error generando PNG"))),
      "image/png",
      0.95
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
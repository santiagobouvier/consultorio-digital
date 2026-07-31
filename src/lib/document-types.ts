// Tipos de documento: los 6 de fábrica + los que crea cada consultorio
// (tabla business_document_types, con ícono elegido). Los propios se
// guardan en patient_documents.document_type por su id (uuid); este módulo
// resuelve etiqueta e ícono para cualquiera de los dos casos.
import {
  BookOpen,
  Brain,
  ClipboardList,
  File,
  FileText,
  FlaskConical,
  Folder,
  HeartPulse,
  Image,
  PenLine,
  Pill,
  Receipt,
  Scan,
  Smile,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";

/** Catálogo de íconos elegibles al crear un tipo (clave → componente). */
export const DOC_TYPE_ICONS: Record<string, LucideIcon> = {
  folder: Folder,
  "file-text": FileText,
  clipboard: ClipboardList,
  pen: PenLine,
  book: BookOpen,
  receipt: Receipt,
  scan: Scan,
  pill: Pill,
  stethoscope: Stethoscope,
  syringe: Syringe,
  heart: HeartPulse,
  brain: Brain,
  smile: Smile,
  flask: FlaskConical,
  image: Image,
};

export interface BusinessDocType {
  id: string;
  label: string;
  icon: string;
}

/** Tipos de fábrica: existen en todos los consultorios, sin configurar nada. */
export const BUILT_IN_DOC_TYPES: { code: string; label: string; icon: string }[] = [
  { code: "informe", label: "Informe", icon: "file-text" },
  { code: "evaluacion", label: "Evaluación", icon: "clipboard" },
  { code: "consentimiento", label: "Consentimiento", icon: "pen" },
  { code: "indicaciones", label: "Indicaciones / Material", icon: "book" },
  { code: "recibo", label: "Recibo", icon: "receipt" },
  { code: "otro", label: "Otro", icon: "folder" },
];

/** Etiqueta + ícono para cualquier valor de document_type (fábrica o propio). */
export function resolveDocType(
  code: string | null | undefined,
  customTypes: BusinessDocType[],
): { label: string; Icon: LucideIcon } {
  const builtin = BUILT_IN_DOC_TYPES.find((t) => t.code === code);
  if (builtin) return { label: builtin.label, Icon: DOC_TYPE_ICONS[builtin.icon] ?? File };
  const custom = customTypes.find((t) => t.id === code);
  if (custom) return { label: custom.label, Icon: DOC_TYPE_ICONS[custom.icon] ?? Folder };
  return { label: code || "Otro", Icon: File };
}

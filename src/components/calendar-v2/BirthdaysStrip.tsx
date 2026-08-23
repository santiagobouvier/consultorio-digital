// Cumpleaños de pacientes dentro del rango visible de la agenda.
// Un toque en el botón abre WhatsApp con el saludo pre-armado (envío
// SIEMPRE manual: el profesional decide si lo manda).
import { useMemo } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Cake, MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";

interface BirthdayPatient {
  id: string;
  full_name: string;
  whatsapp_phone: string | null;
  birth_date?: string | null;
}

interface BirthdaysStripProps {
  patients: BirthdayPatient[];
  rangeStart: Date;
  rangeEnd: Date;
  clinicName: string;
}

type BirthdayHit = {
  patient: BirthdayPatient;
  date: Date;
  isToday: boolean;
};

export const BirthdaysStrip = ({ patients, rangeStart, rangeEnd, clinicName }: BirthdaysStripProps) => {
  const hits = useMemo<BirthdayHit[]>(() => {
    const withBirthday = patients.filter((p) => p.birth_date);
    if (withBirthday.length === 0) return [];

    // Días del rango visible (la agenda nunca muestra más de ~6 semanas)
    const days: Date[] = [];
    const cursor = new Date(rangeStart);
    cursor.setHours(12, 0, 0, 0);
    let guard = 0;
    while (cursor <= rangeEnd && guard < 45) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }

    const today = new Date();
    const out: BirthdayHit[] = [];
    for (const p of withBirthday) {
      // birth_date es "YYYY-MM-DD": comparar mes/día sin tocar zonas horarias
      const [, mm, dd] = (p.birth_date as string).split("-").map(Number);
      if (!mm || !dd) continue;
      for (const day of days) {
        if (day.getMonth() + 1 === mm && day.getDate() === dd) {
          out.push({ patient: p, date: day, isToday: isSameDay(day, today) });
          break;
        }
      }
    }
    return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 12);
  }, [patients, rangeStart, rangeEnd]);

  if (hits.length === 0) return null;

  const greet = (p: BirthdayPatient) => {
    const firstName = p.full_name.trim().split(/\s+/)[0];
    openWhatsApp(
      p.whatsapp_phone!,
      `¡Feliz cumpleaños, ${firstName}! 🎂 Que tengas un día hermoso. Un abrazo del equipo de ${clinicName}.`
    );
  };

  return (
    <div className="rounded-2xl border border-pink-200/70 dark:border-pink-500/20 bg-pink-50/60 dark:bg-pink-500/[0.07] px-3.5 py-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-pink-600 dark:text-pink-300 shrink-0">
          <Cake className="h-4 w-4" />
          Cumpleaños
        </span>
        {hits.map((hit) => (
          <span
            key={`${hit.patient.id}-${hit.date.toDateString()}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-pink-200/80 dark:border-pink-500/25 bg-card px-2.5 py-1 text-xs"
          >
            <span className="font-medium">{hit.patient.full_name}</span>
            <span className="text-muted-foreground">
              {hit.isToday ? "¡hoy!" : format(hit.date, "EEE d", { locale: es })}
            </span>
            {hit.patient.whatsapp_phone && (
              <button
                type="button"
                onClick={() => greet(hit.patient)}
                className="ml-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 transition-colors hover:bg-emerald-500/25"
                title="Mandar saludo por WhatsApp"
                aria-label={`Saludar a ${hit.patient.full_name} por WhatsApp`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

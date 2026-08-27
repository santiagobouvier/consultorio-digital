import { supabase } from "@/integrations/supabase/client";

/** Bloque ocupado del calendario personal (Google / iPhone), en minutos
 *  del día local. label = «Dentista» (Google Calendar). */
export interface ExternalBusyBlock {
  start: number;
  end: number;
  label: string;
}

// Cache cortito por día: la función va a buscar el .ics remoto, no tiene
// sentido repetir el viaje si el usuario va y vuelve entre días.
const cache = new Map<string, { at: number; data: ExternalBusyBlock[] }>();
const TTL_MS = 2 * 60 * 1000;

/** Bloques ocupados del calendario personal para un día (YYYY-MM-DD).
 *  Silencioso: sin calendarios conectados o con error devuelve []. */
export const fetchExternalBusyDay = async (dayStr: string): Promise<ExternalBusyBlock[]> => {
  const hit = cache.get(dayStr);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  try {
    const from = new Date(`${dayStr}T00:00:00`);
    const to = new Date(`${dayStr}T23:59:59`);
    const { data, error } = await supabase.functions.invoke("external-calendar", {
      body: { action: "busy", from: from.toISOString(), to: to.toISOString() },
    });
    if (error || !Array.isArray(data?.busy)) return [];
    const blocks = (data.busy as { start: string; end: string; title: string; calendar: string }[])
      .map((b) => {
        const s = new Date(b.start);
        const e = new Date(b.end);
        const cs = s < from ? from : s;
        const ce = e > to ? to : e;
        return {
          start: cs.getHours() * 60 + cs.getMinutes(),
          end: ce.getHours() * 60 + ce.getMinutes(),
          label: `«${b.title}» (${b.calendar})`,
        };
      })
      .filter((b) => b.end > b.start);
    cache.set(dayStr, { at: Date.now(), data: blocks });
    return blocks;
  } catch {
    return [];
  }
};

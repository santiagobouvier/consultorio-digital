import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Preferencia booleana de interfaz que persiste en la cuenta del usuario
// (profiles.ui_prefs) con atajo en localStorage para que no haya "salto"
// visual mientras se consulta la base. Así lo que el usuario oculta o
// minimiza no reaparece al cambiar de dispositivo ni al limpiar el navegador.
export function useUiPref(key: string, defaultValue = false): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const local = localStorage.getItem(`ui_pref_${key}`);
      if (local !== null) return local === "1";
    } catch {
      /* ignore */
    }
    return defaultValue;
  });
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data, error } = await (supabase as any)
          .from("profiles")
          .select("ui_prefs")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled || error) return;
        const stored = data?.ui_prefs?.[keyRef.current];
        if (typeof stored === "boolean") {
          setValue(stored);
          try { localStorage.setItem(`ui_pref_${keyRef.current}`, stored ? "1" : "0"); } catch { /* ignore */ }
        }
      } catch {
        /* ignore: queda el valor local/default */
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [key]);

  const update = (v: boolean) => {
    setValue(v);
    try { localStorage.setItem(`ui_pref_${key}`, v ? "1" : "0"); } catch { /* ignore */ }
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await (supabase as any)
          .from("profiles")
          .select("ui_prefs")
          .eq("id", user.id)
          .maybeSingle();
        const prefs = { ...(data?.ui_prefs ?? {}), [key]: v };
        await (supabase as any).from("profiles").update({ ui_prefs: prefs }).eq("id", user.id);
      } catch {
        /* ignore: el atajo local mantiene la preferencia en este navegador */
      }
    })();
  };

  return [value, update];
}

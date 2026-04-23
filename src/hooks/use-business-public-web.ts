import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessId } from "./use-business-id";
import { getPlanDefinition } from "@/lib/plan-definitions";

/**
 * Devuelve si el negocio del usuario actual tiene habilitada la web pública,
 * según `hasPublicWeb` de la definición de su plan actual.
 *
 * Se usa para ocultar secciones del panel (Mi Consultorio, Personalizar Portal)
 * que ofrecen funciones exclusivas de planes con web pública.
 */
export function useBusinessPublicWeb() {
  const { businessId, loading: bizLoading } = useBusinessId();
  const [loading, setLoading] = useState(true);
  const [hasPublicWeb, setHasPublicWeb] = useState(false);
  const [planCode, setPlanCode] = useState<string | null>(null);

  useEffect(() => {
    if (bizLoading) return;
    if (!businessId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("businesses")
          .select("plan_code")
          .eq("id", businessId)
          .maybeSingle();
        if (cancelled) return;
        if (error || !data) {
          setHasPublicWeb(false);
          setPlanCode(null);
        } else {
          const def = getPlanDefinition(data.plan_code);
          setPlanCode(data.plan_code);
          setHasPublicWeb(Boolean(def.hasPublicWeb));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, bizLoading]);

  return { hasPublicWeb, planCode, loading: loading || bizLoading };
}
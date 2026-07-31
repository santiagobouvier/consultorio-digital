import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BusinessDocType } from "@/lib/document-types";

/** Tipos de documento propios del consultorio, con refresco tras crear uno. */
export function useDocumentTypes(businessId: string | null | undefined) {
  const [customTypes, setCustomTypes] = useState<BusinessDocType[]>([]);

  const refresh = useCallback(async () => {
    if (!businessId) return;
    const { data } = await supabase
      .from("business_document_types")
      .select("id, label, icon")
      .eq("business_id", businessId)
      .order("label");
    setCustomTypes((data as BusinessDocType[]) || []);
  }, [businessId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { customTypes, refresh };
}

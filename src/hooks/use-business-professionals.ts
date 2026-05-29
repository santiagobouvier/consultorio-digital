import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CoordinationMode = "shared" | "independent";

export interface BusinessProfessional {
  userId: string;
  role: string;
  coordinationMode: CoordinationMode;
  name: string;
  email: string;
  isOwner: boolean;
  futureSharedAppointmentsCount: number;
}

export function useBusinessProfessionals(businessId: string | null) {
  const [professionals, setProfessionals] = useState<BusinessProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!businessId) {
      setProfessionals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .maybeSingle();

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role, coordination_mode")
        .eq("business_id", businessId)
        .in("role", ["owner", "professional"]);
      if (rolesError) throw rolesError;

      const userIds = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (userIds.length === 0) {
        setProfessionals([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

      const nowIso = new Date().toISOString();
      const { data: futureAppts } = await supabase
        .from("appointments")
        .select("professional_id, space_id, spaces!inner(owned_by_user_id)")
        .eq("business_id", businessId)
        .gte("start_at", nowIso)
        .in("professional_id", userIds);

      const futureSharedCount = new Map<string, number>();
      for (const a of (futureAppts as any[]) ?? []) {
        if (a.spaces?.owned_by_user_id === null && a.professional_id) {
          futureSharedCount.set(a.professional_id, (futureSharedCount.get(a.professional_id) ?? 0) + 1);
        }
      }

      const list: BusinessProfessional[] = (roles ?? []).map((r: any) => {
        const p = profileMap.get(r.user_id);
        return {
          userId: r.user_id,
          role: r.role,
          coordinationMode: (r.coordination_mode as CoordinationMode) ?? "shared",
          name: p?.name ?? "Sin nombre",
          email: p?.email ?? "",
          isOwner: business?.owner_user_id === r.user_id,
          futureSharedAppointmentsCount: futureSharedCount.get(r.user_id) ?? 0,
        };
      });
      list.sort((a, b) => (a.isOwner === b.isOwner ? a.name.localeCompare(b.name) : a.isOwner ? -1 : 1));
      setProfessionals(list);
    } catch (e: any) {
      setError(e.message ?? "Error cargando profesionales");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const updateCoordinationMode = async (userId: string, mode: CoordinationMode) => {
    if (!businessId) throw new Error("Sin consultorio");
    const { error } = await supabase
      .from("user_roles")
      .update({ coordination_mode: mode })
      .eq("business_id", businessId)
      .eq("user_id", userId);
    if (error) throw error;
    await refetch();
  };

  return { professionals, loading, error, refetch, updateCoordinationMode };
}
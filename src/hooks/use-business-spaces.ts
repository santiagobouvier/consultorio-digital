import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BusinessSpace {
  id: string;
  business_id: string;
  name: string;
  type: "physical" | "virtual";
  capacity: number;
  color: string | null;
  notes: string | null;
  is_active: boolean;
  owned_by_user_id: string | null;
  appointmentCount: number;
  futureAppointmentCount: number;
}

export interface SpaceInput {
  name: string;
  type: "physical" | "virtual";
  capacity: number;
  color?: string | null;
  notes?: string | null;
}

export function useBusinessSpaces(businessId: string | null) {
  const [spaces, setSpaces] = useState<BusinessSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!businessId) {
      setSpaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data: spacesData, error: spacesError } = await supabase
        .from("spaces")
        .select("*")
        .eq("business_id", businessId)
        .order("is_active", { ascending: false })
        .order("name");
      if (spacesError) throw spacesError;

      const ids = (spacesData ?? []).map((s) => s.id);
      const counts = new Map<string, { total: number; future: number }>();
      if (ids.length > 0) {
        const { data: appts } = await supabase
          .from("appointments")
          .select("space_id, start_at")
          .eq("business_id", businessId)
          .in("space_id", ids);
        const nowIso = new Date().toISOString();
        for (const a of appts ?? []) {
          if (!a.space_id) continue;
          const c = counts.get(a.space_id) ?? { total: 0, future: 0 };
          c.total += 1;
          if (a.start_at && a.start_at >= nowIso) c.future += 1;
          counts.set(a.space_id, c);
        }
      }

      setSpaces(
        (spacesData ?? []).map((s) => ({
          ...(s as any),
          appointmentCount: counts.get(s.id)?.total ?? 0,
          futureAppointmentCount: counts.get(s.id)?.future ?? 0,
        })),
      );
    } catch (e: any) {
      setError(e.message ?? "Error cargando espacios");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createSharedSpace = async (input: SpaceInput) => {
    if (!businessId) throw new Error("Sin consultorio");
    const { error } = await supabase.from("spaces").insert({
      business_id: businessId,
      name: input.name,
      type: input.type,
      capacity: input.capacity,
      color: input.color ?? null,
      notes: input.notes ?? null,
      owned_by_user_id: null,
      is_active: true,
    });
    if (error) throw error;
    await refetch();
  };

  const updateSpace = async (id: string, input: Partial<SpaceInput>) => {
    const { error } = await supabase.from("spaces").update(input).eq("id", id);
    if (error) throw error;
    await refetch();
  };

  const archiveSpace = async (id: string) => {
    const { error } = await supabase.from("spaces").update({ is_active: false }).eq("id", id);
    if (error) throw error;
    await refetch();
  };

  const restoreSpace = async (id: string) => {
    const { error } = await supabase.from("spaces").update({ is_active: true }).eq("id", id);
    if (error) throw error;
    await refetch();
  };

  const deleteSpace = async (id: string) => {
    const { error } = await supabase.from("spaces").delete().eq("id", id);
    if (error) throw error;
    await refetch();
  };

  return {
    spaces,
    sharedSpaces: spaces.filter((s) => s.owned_by_user_id === null),
    independentSpaces: spaces.filter((s) => s.owned_by_user_id !== null),
    loading,
    error,
    refetch,
    createSharedSpace,
    updateSpace,
    archiveSpace,
    restoreSpace,
    deleteSpace,
  };
}
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Professional, PROFESSIONAL_COLORS } from "@/components/calendar-v2/types";
interface UseProfessionalsResult {
  professionals: Professional[];
  loading: boolean;
  currentUserId: string | null;
  isOwner: boolean;
  refetch: () => Promise<void>;
}

export const useProfessionals = (businessId: string | null): UseProfessionalsResult => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const fetchProfessionals = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      // Check if current user is owner
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_user_id")
        .eq("id", businessId)
        .single();

      setIsOwner(business?.owner_user_id === user?.id);

      // Get all professionals in the business
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select(`
          id,
          user_id,
          role,
          calendar_color
        `)
        .eq("business_id", businessId)
        .in("role", ["owner", "professional"]);

      if (error) throw error;

      if (!roles || roles.length === 0) {
        setProfessionals([]);
        setLoading(false);
        return;
      }

      // Get profile info for each professional
      const userIds = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const professionalsData: Professional[] = roles.map((role, index) => {
        const profile = profiles?.find((p) => p.id === role.user_id);
        return {
          id: role.id,
          userId: role.user_id,
          name: profile?.name || "Profesional",
          color: role.calendar_color || PROFESSIONAL_COLORS[index % PROFESSIONAL_COLORS.length],
        };
      });

      setProfessionals(professionalsData);
    } catch (error) {
      console.error("Error fetching professionals:", error);
      setProfessionals([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchProfessionals();
  }, [fetchProfessionals]);

  return {
    professionals,
    loading,
    currentUserId,
    isOwner,
    refetch: fetchProfessionals,
  };
};

import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Prefetch ligero por ruta. Se dispara en hover/focus de los items del sidebar
 * para que cuando el usuario haga clic los datos básicos ya estén calientes.
 *
 * Importante: estos prefetches usan claves alineadas con las queries reales
 * que cada página debería migrar a useQuery. Mientras tanto, sirven para
 * calentar la caché de Supabase a nivel red (HTTP keep-alive + planner cache).
 */
export async function prefetchRoute(
  queryClient: QueryClient,
  route: string,
  businessId: string | null,
) {
  if (!businessId) return;

  const common = { staleTime: 30_000, gcTime: 300_000 };

  switch (route) {
    case "/patients":
      await queryClient.prefetchQuery({
        queryKey: ["patients", businessId],
        queryFn: async () => {
          const { data } = await supabase
            .from("patients")
            .select("*")
            .eq("business_id", businessId)
            .order("full_name", { ascending: true });
          return data ?? [];
        },
        ...common,
      });
      break;

    case "/pagos":
      await queryClient.prefetchQuery({
        queryKey: ["payments", businessId],
        queryFn: async () => {
          const { data } = await supabase
            .from("payments")
            .select("*, patients(full_name, whatsapp_phone)")
            .eq("business_id", businessId)
            .order("due_date", { ascending: false })
            .limit(200);
          return data ?? [];
        },
        ...common,
      });
      break;

    case "/recordatorios-pendientes":
      await queryClient.prefetchQuery({
        queryKey: ["reminders", businessId],
        queryFn: async () => {
          const { data } = await supabase
            .from("scheduled_reminders")
            .select("*")
            .eq("business_id", businessId)
            .order("scheduled_for", { ascending: true })
            .limit(100);
          return data ?? [];
        },
        ...common,
      });
      break;

    case "/agenda": {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString();
      await queryClient.prefetchQuery({
        queryKey: ["appointments", businessId, "month", today.getMonth()],
        queryFn: async () => {
          const { data } = await supabase
            .from("appointments")
            .select("*, patients(full_name)")
            .eq("business_id", businessId)
            .gte("start_at", start)
            .lt("start_at", end);
          return data ?? [];
        },
        ...common,
      });
      break;
    }

    case "/solicitudes":
      await queryClient.prefetchQuery({
        queryKey: ["appointment_requests", businessId],
        queryFn: async () => {
          const { data } = await supabase
            .from("appointment_requests")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50);
          return data ?? [];
        },
        ...common,
      });
      break;

    default:
      // Ruta sin prefetch específico — no hacemos nada.
      break;
  }
}

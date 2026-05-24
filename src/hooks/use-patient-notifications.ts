import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PatientNotificationType =
  | "appointment_confirmed"
  | "appointment_cancelled_by_professional"
  | "reschedule_approved"
  | "reschedule_rejected"
  | "payment_received"
  | "appointment_created_by_professional"
  | "payment_due_soon";

export interface PatientNotification {
  id: string;
  patient_id: string;
  business_id: string;
  type: PatientNotificationType | string;
  title: string;
  body: string;
  related_appointment_id: string | null;
  related_payment_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export function usePatientNotifications(patientId: string | null | undefined) {
  const [notifications, setNotifications] = useState<PatientNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!patientId) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("patient_notifications")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setNotifications(data as unknown as PatientNotification[]);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!patientId) return;
    const channel = supabase
      .channel(`patient_notifications:${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_notifications",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, load]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    );
    await supabase
      .from("patient_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .is("read_at", null);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!patientId) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("patient_notifications")
      .update({ read_at: now })
      .eq("patient_id", patientId)
      .is("read_at", null);
  }, [patientId]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, reload: load };
}
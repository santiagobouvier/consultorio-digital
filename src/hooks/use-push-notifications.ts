import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAlreadyRegistered, withPushLock } from "@/lib/push-binding";
import { appPushDeps, reconcileThisDevice } from "@/lib/push-account";

const VAPID_PUBLIC_KEY = "BFNi8-zSTKYmf17dMpsLQzK5-uTztO6dnxX6obZzIrVMR987MuubSMjD01s3djoHxmi4f_o86O7YCiPH6fWCxPc";

/**
 * To regenerate VAPID keys:
 *   npx web-push generate-vapid-keys
 * Then update VAPID_PUBLIC_KEY here and the secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
 */

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type DeviceType = "ios" | "android" | "desktop";

function getDeviceType(): DeviceType {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsIOSInstall, setNeedsIOSInstall] = useState(false);

  const deviceType = getDeviceType();
  const isPWAInstalled = isStandalone();
  const supportsNotifications = "Notification" in window && "serviceWorker" in navigator;

  // "Activas" significa: este navegador tiene suscripción Y es de la cuenta
  // con sesión (fila propia con ese endpoint). Una suscripción de otra cuenta
  // se da de baja acá mismo (ver src/lib/push-binding.ts).
  const refreshStatus = useCallback(async () => {
    if (!supportsNotifications) return;
    setPermission(Notification.permission);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { state } = await reconcileThisDevice(session?.user?.id ?? null);
      setIsSubscribed(state === "active");
    } catch {
      setIsSubscribed(false);
    }
  }, [supportsNotifications]);

  useEffect(() => {
    if (!supportsNotifications) {
      setPermission("unsupported");
      return;
    }
    void refreshStatus();
    // Cambio de cuenta (logout, login, otra cuenta) en esta u otra pestaña
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // INITIAL_SESSION ya lo cubre la revisión de arriba
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      setIsSubscribed(false);
      window.setTimeout(() => void refreshStatus(), 0);
    });
    // Al volver a la pestaña (p. ej. se activó o se cambió el permiso en otra)
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshStatus();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supportsNotifications, refreshStatus]);

  const subscribe = useCallback(async () => {
    // iOS without PWA installed → show guide
    if (deviceType === "ios" && !isPWAInstalled) {
      setNeedsIOSInstall(true);
      return false;
    }

    if (!supportsNotifications) return false;

    setLoading(true);
    try {
      // El permiso se pide acá, como respuesta directa al clic.
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      const ok = await withPushLock(async () => {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (sub && (await appPushDeps.ownsEndpoint(user.id, sub.endpoint))) return true; // ya es de esta cuenta
        if (sub) {
          // Es de otra cuenta (o de nadie): se reemplaza por una nueva, propia.
          await sub.unsubscribe().catch(() => false);
          sub = null;
        }
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const json = sub.toJSON();
        const { data: bizId } = await supabase.rpc("get_user_business_id", { _user_id: user.id });
        const { error } = await supabase.from("push_subscriptions").insert({
          user_id: user.id,
          business_id: bizId || undefined,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
          device_type: deviceType,
        });
        if (error && !isAlreadyRegistered(error)) {
          // Sin fila no llegan avisos: no se deja una suscripción huérfana.
          await sub.unsubscribe().catch(() => false);
          throw error;
        }
        return true;
      });

      setIsSubscribed(ok);
      setLoading(false);
      return ok;
    } catch (err) {
      console.error("Push subscribe error:", err);
      setIsSubscribed(false);
      setLoading(false);
      return false;
    }
  }, [deviceType, isPWAInstalled, supportsNotifications]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    }
  }, []);

  const dismissIOSGuide = useCallback(() => setNeedsIOSInstall(false), []);

  return {
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    deviceType,
    isPWAInstalled,
    needsIOSInstall,
    dismissIOSGuide,
    supportsNotifications,
  };
}

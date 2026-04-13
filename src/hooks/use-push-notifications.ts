import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    if (!supportsNotifications) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    // Check if already subscribed
    if (Notification.permission === "granted") {
      checkExistingSubscription();
    }
  }, []);

  const checkExistingSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch {
      setIsSubscribed(false);
    }
  };

  const subscribe = useCallback(async () => {
    // iOS without PWA installed → show guide
    if (deviceType === "ios" && !isPWAInstalled) {
      setNeedsIOSInstall(true);
      return false;
    }

    if (!supportsNotifications) return false;

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== "granted") {
        setLoading(false);
        return false;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userApplicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const json = sub.toJSON();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user");

      // Get business_id
      const { data: bizId } = await supabase.rpc("get_user_business_id", { _user_id: user.id });

      await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          business_id: bizId || undefined,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh!,
          auth: json.keys!.auth!,
          device_type: deviceType,
        },
        { onConflict: "user_id,endpoint" }
      );

      setIsSubscribed(true);
      setLoading(false);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
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

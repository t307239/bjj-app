/**
 * lib/webpush.ts
 *
 * Client-side helper: subscribe / unsubscribe from Web Push notifications.
 *
 * Usage:
 *   import { subscribePush, unsubscribePush, getPushVapidKey } from "@/lib/webpush";
 *
 * Prerequisites (user must configure):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY — public VAPID key for push subscription
 *   (Server-side) VAPID_PRIVATE_KEY, VAPID_SUBJECT — used by push sender (Edge Function / API)
 *
 * Generate VAPID keys:
 *   npx web-push generate-vapid-keys
 */

import { logClientError } from "@/lib/logger";

export function getPushVapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

/**
 * Subscribe the current device to Web Push.
 * Saves the subscription to Supabase via /api/push/subscribe.
 * Returns true on success, false if push is not supported or permission denied.
 */
export async function subscribePush(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidKey = getPushVapidKey();
  if (!vapidKey) {
    logClientError("push.vapid_key_missing", new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set"));
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // Already subscribed — re-save to ensure it's in DB (idempotent)
      await savePushSubscription(existing);
      return true;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // 10s timeout — Brave's push relay can be slow; avoids infinite hang
    const subscription = await Promise.race([
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Push subscribe timeout")), 10_000)
      ),
    ]);

    await savePushSubscription(subscription);
    return true;
  } catch (err) {
    logClientError("push.subscribe_error", err);
    return false;
  }
}

/**
 * Unsubscribe the current device from Web Push.
 * Removes the subscription from Supabase and the browser.
 */
export async function unsubscribePush(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    // Remove from DB first
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });

    // Unsubscribe from browser
    await subscription.unsubscribe();
  } catch (err) {
    logClientError("push.unsubscribe_error", err);
  }
}

async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  // タイムゾーンを取得して送信。Edge Function がサイレント時間帯 (22:00-08:00) を
  // 判断するために必須。取得できない場合は "UTC" にフォールバック。
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      timezone,
      keys: {
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      },
    }),
  });
}

/** Convert a base64url string to a Uint8Array (required by pushManager.subscribe) */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

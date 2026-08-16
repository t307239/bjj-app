/**
 * lib/robust/push.ts
 *
 * ROBUST 会員向け Web Push のクライアントヘルパー。
 * 本体 lib/webpush.ts と同じ VAPID 公開鍵を使うが、購読の保存先は
 * ROBUST 専用エンドポイント (/api/gym/robust/push/*) = gym-member-hub DB。
 *
 * 前提: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT は
 *       本体で設定済みのものを共用する（新規発行不要）。
 */
"use client";

const SUBSCRIBE_TIMEOUT_MS = 10_000; // Brave のリレーが遅い場合のハング防止

export function getRobustVapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
}

/** 現在の端末を ROBUST の Web Push に登録。成功で true、未対応/不許可で false。 */
export async function subscribeRobustPush(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const vapidKey = getRobustVapidKey();
  if (!vapidKey) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      // 既に購読済み → DB へ再保存（冪等）
      await saveSubscription(existing);
      return true;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const subscription = await Promise.race([
      registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("push subscribe timeout")), SUBSCRIBE_TIMEOUT_MS)
      ),
    ]);

    await saveSubscription(subscription);
    return true;
  } catch {
    // 失敗時は false を返し UI 側でフィードバック（例外は握りつぶさず呼び出し側で扱う）
    return false;
  }
}

/** 現在の端末を ROBUST の Web Push から解除。 */
export async function unsubscribeRobustPush(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await fetch("/api/gym/robust/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch {
    // 解除失敗は致命的でないため無視（次回購読時に冪等に上書きされる）
  }
}

/** この端末が既に ROBUST push を購読しているか（UI の初期トグル状態用）。 */
export async function isRobustPushSubscribed(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return sub !== null;
  } catch {
    return false;
  }
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Asia/Tokyo";
  await fetch("/api/gym/robust/push/subscribe", {
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

/** base64url → Uint8Array（pushManager.subscribe が要求する形式） */
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

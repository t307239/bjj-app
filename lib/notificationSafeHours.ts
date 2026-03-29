/**
 * lib/notificationSafeHours.ts
 *
 * Notification Terrorism 防止ユーティリティ。
 * Push通知を送信する Edge Function / cron からインポートして使う。
 *
 * ルール:
 *   - 22:00 〜 08:00（ローカル時刻）= サイレント時間帯 → 送信禁止
 *   - 08:00 〜 22:00（ローカル時刻）= 送信可能
 *
 * 使用例 (Edge Function):
 *   import { isSilentHour } from "../../lib/notificationSafeHours.ts";
 *   if (isSilentHour(subscription.timezone)) continue; // skip this user
 */

/** サイレント時間帯の開始・終了（24h形式） */
const SILENT_START = 22; // 22:00
const SILENT_END   = 8;  //  8:00

/**
 * 指定タイムゾーンの現在時刻がサイレント時間帯（22:00-08:00）かどうかを返す。
 * IANA timezone 文字列が無効な場合は安全側に倒して true（送信禁止）を返す。
 *
 * @param timezone - IANA timezone string (e.g. "Asia/Tokyo", "America/New_York")
 * @param now      - テスト用に現在時刻を注入できる（省略時は Date.now()）
 */
export function isSilentHour(timezone: string, now?: Date): boolean {
  try {
    const date = now ?? new Date();
    const hour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: timezone,
      }).format(date),
      10
    );
    // 22:00 <= hour  OR  hour < 08:00
    return hour >= SILENT_START || hour < SILENT_END;
  } catch {
    // 不明なタイムゾーン → 安全側（送信禁止）
    return true;
  }
}

/**
 * 送信可能かどうかを返す（isSilentHour の反転）。
 * Edge Function のメインループで使いやすいように提供。
 */
export function isOptimalSendTime(timezone: string, now?: Date): boolean {
  return !isSilentHour(timezone, now);
}

/**
 * 複数のタイムゾーンをフィルタリングして送信可能なものだけ返す。
 *
 * @example
 *   const sendable = filterSendableSubscriptions(subscriptions, s => s.timezone);
 */
export function filterSendableSubscriptions<T>(
  subscriptions: T[],
  getTimezone: (sub: T) => string,
  now?: Date
): T[] {
  return subscriptions.filter((sub) => isOptimalSendTime(getTimezone(sub), now));
}

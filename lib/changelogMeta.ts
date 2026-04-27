/**
 * changelogMeta.ts — z216: changelog stale detection metadata.
 *
 * /changelog page (z203) は indie credibility の証拠だが、更新忘れで
 * stale 化すると逆に「indie sluggish?」signal になる。app/api/cron/
 * changelog-stale/route.ts が本 const を読み、N 日以上前なら Telegram
 * 通知。
 *
 * 更新ルール:
 *   /changelog の COPY.{ja,en,pt}.months に新月を追加した時、必ずこの
 *   定数も同時に bump (ISO date, "YYYY-MM-DD" 形式)。
 */

export const CHANGELOG_LAST_UPDATED = "2026-04-27";

/** stale と判定する閾値 (日数)。30 = 月次更新方針の grace 込み */
export const CHANGELOG_STALE_THRESHOLD_DAYS = 30;

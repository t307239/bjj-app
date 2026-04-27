/**
 * GET /api/cron/changelog-stale — z216 (F-15)
 *
 * 目的:
 *   /changelog (z203) が CHANGELOG_STALE_THRESHOLD_DAYS (30日) 以上
 *   更新されていない場合に Telegram 通知。indie credibility は
 *   「実際に shipping している証拠」だが、stale 化すると逆効果。
 *
 * 起動:
 *   vercel.json の crons に "0 0 * * 1" (毎週月曜 0:00 UTC = 9:00 JST)
 *
 * 設計:
 *   - verifyCronAuth で fail-closed (z169 統一)
 *   - lib/changelogMeta.ts の CHANGELOG_LAST_UPDATED と現在日時 diff
 *   - threshold 超過なら Telegram alert (TELEGRAM_BOT_TOKEN/CHAT_ID 経由)
 *   - 既存 lib/alertRouter.ts が Telegram 送信 helper を提供
 *
 * 副次効果:
 *   - Sentry で WARNING レベルの telemetry も残せる (将来の retro 用)
 */

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cronAuth";
import { logger } from "@/lib/logger";
import {
  CHANGELOG_LAST_UPDATED,
  CHANGELOG_STALE_THRESHOLD_DAYS,
} from "@/lib/changelogMeta";

const log = logger.child({ scope: "cron/changelog-stale" });

async function notifyTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    log.info("telegram_not_configured", {});
    return false;
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
    );
    return res.ok;
  } catch (err: unknown) {
    log.warn("telegram_send_failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export async function GET(req: Request) {
  // ── Auth: fail-closed CRON_SECRET (z169) ─────────────────────────
  const auth = verifyCronAuth(req);
  if (!auth.ok) return auth.response;

  const lastUpdated = new Date(CHANGELOG_LAST_UPDATED + "T00:00:00Z");
  const now = new Date();
  const ageDays = Math.floor(
    (now.getTime() - lastUpdated.getTime()) / 86400000,
  );

  if (ageDays < CHANGELOG_STALE_THRESHOLD_DAYS) {
    return NextResponse.json({
      ok: true,
      stale: false,
      ageDays,
      threshold: CHANGELOG_STALE_THRESHOLD_DAYS,
    });
  }

  // Stale → Telegram 通知
  const text = [
    "📅 *Changelog stale alert*",
    "",
    `/changelog の最終更新が ${ageDays} 日前です。`,
    `(threshold: ${CHANGELOG_STALE_THRESHOLD_DAYS}日)`,
    "",
    "新月を追加し、`lib/changelogMeta.ts` の",
    "`CHANGELOG_LAST_UPDATED` も同時に bump してください。",
    "",
    "indie credibility の証拠 page なので stale 化は逆効果。",
  ].join("\n");

  const sent = await notifyTelegram(text);
  log.warn("changelog_stale", { ageDays, sent });

  return NextResponse.json({
    ok: true,
    stale: true,
    ageDays,
    threshold: CHANGELOG_STALE_THRESHOLD_DAYS,
    notified: sent,
  });
}

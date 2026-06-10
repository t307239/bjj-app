/**
 * robust/logger.ts — ROBUST 専用のエラー/警告ロガー（Sentry 転送）
 *
 * Why: ROBUST(道場会員管理)を bjj-app 本体のソースから独立させるため、
 *      本体の lib/clientLogger.ts への依存を断ち、ROBUST 配下に自己完結した
 *      ロガーを持つ。外部依存は @sentry/nextjs(npm パッケージ)のみで、
 *      bjj-app が書いたモジュールには一切依存しない。
 *      これにより ROBUST を別リポジトリ/別デプロイに切り出す際も無改修で済む。
 *
 * event + meta + err のインターフェースは本体ロガーと互換（移行容易性のため）。
 */
import * as Sentry from "@sentry/nextjs";

type RobustLogLevel = "info" | "warn" | "error";

function report(
  level: RobustLogLevel,
  event: string,
  meta: Record<string, unknown> = {},
  err?: unknown,
): void {
  if (level === "error") {
    if (err instanceof Error) {
      Sentry.captureException(err, { tags: { event }, extra: meta });
    } else {
      Sentry.captureMessage(`[${event}] ${err ?? "unknown error"}`, {
        level: "error",
        tags: { event },
        extra: meta,
      });
    }
  } else {
    // info / warn は Sentry の message レベルにマップ（happy path の milestone も記録）
    Sentry.captureMessage(`[${event}] ${level}`, {
      level: level === "warn" ? "warning" : "info",
      tags: { event },
      extra: meta,
    });
  }

  // 開発時の可視性のため構造化ログを console にも出す
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...meta,
    ...(err instanceof Error
      ? { error: { message: err.message, name: err.name } }
      : err !== undefined
        ? { error: String(err) }
        : {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const robustLogger = {
  info: (event: string, meta: Record<string, unknown> = {}) =>
    report("info", event, meta),
  warn: (event: string, meta: Record<string, unknown> = {}) =>
    report("warn", event, meta),
  error: (event: string, meta: Record<string, unknown> = {}, err?: unknown) =>
    report("error", event, meta, err),
};

"use client";

/**
 * InjuryCareAlert — 怪我・筋肉痛のケアアラート（スヌーズ付き）
 *
 * body_statusのsore/injuredパーツを検出し、経過日数に応じたケア提案を表示。
 * ✕で閉じると7日間非表示（スヌーズ）。
 *
 * firstSeen: DBのbody_status_dates（デバイス跨ぎ対応）
 * snooze: localStorage（UI設定なのでローカルで十分）
 * localStorage key: "bjj_injury_snooze"
 * Format: { [partKey]: { snoozedUntil: ISO string | null } }
 */

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

interface Props {
  bodyStatus: Record<string, string> | null;
  bodyStatusDates: Record<string, string>; // DB-stored first-seen dates per part
}

// Snooze-only localStorage (firstSeen now lives in DB via body_status_dates)
type SnoozeMap = Record<string, { snoozedUntil: string | null }>;

const LS_SNOOZE_KEY = "bjj_injury_snooze";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function loadSnooze(): SnoozeMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_SNOOZE_KEY);
    return raw ? (JSON.parse(raw) as SnoozeMap) : {};
  } catch {
    return {};
  }
}

function saveSnooze(map: SnoozeMap): void {
  try {
    localStorage.setItem(LS_SNOOZE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

// ─── Alert config by elapsed days ─────────────────────────────────────────────

interface AlertConfig {
  emoji: string;
  messageKey: string; // i18n key (body.injuryAlert.*)
  bg: string;
  border: string;
  text: string;
}

function getAlertConfig(daysElapsed: number, status: string): AlertConfig {
  const isInjured = status === "injured";

  if (daysElapsed <= 7) {
    return {
      emoji: "🔴",
      messageKey: isInjured ? "body.injuryAlert.week1Injured" : "body.injuryAlert.week1Sore",
      bg: "bg-red-950/40",
      border: "border-red-500/30",
      text: "text-red-300",
    };
  } else if (daysElapsed <= 21) {
    return {
      emoji: "🟡",
      messageKey: "body.injuryAlert.week3",
      bg: "bg-yellow-950/40",
      border: "border-yellow-500/30",
      text: "text-yellow-300",
    };
  } else {
    return {
      emoji: "⚪",
      messageKey: "body.injuryAlert.month1",
      bg: "bg-zinc-800/40",
      border: "border-zinc-500/30",
      text: "text-zinc-300",
    };
  }
}

// ─── DB snake_case part key → i18n camelCase key mapping ──────────────────────

const PART_I18N: Record<string, string> = {
  neck: "body.parts.neck",
  lower_back: "body.parts.lowerBack",
  left_shoulder: "body.parts.leftShoulder",
  right_shoulder: "body.parts.rightShoulder",
  left_elbow: "body.parts.leftElbow",
  right_elbow: "body.parts.rightElbow",
  left_wrist: "body.parts.leftWrist",
  right_wrist: "body.parts.rightWrist",
  left_hip: "body.parts.leftHip",
  right_hip: "body.parts.rightHip",
  left_knee: "body.parts.leftKnee",
  right_knee: "body.parts.rightKnee",
  left_ankle: "body.parts.leftAnkle",
  right_ankle: "body.parts.rightAnkle",
};

// ─── Main component ────────────────────────────────────────────────────────────

export default function InjuryCareAlert({ bodyStatus, bodyStatusDates }: Props) {
  const { t } = useLocale();
  const [alerts, setAlerts] = useState<
    { partKey: string; status: string; daysElapsed: number; config: AlertConfig }[]
  >([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!bodyStatus) return;

    const today = toDateStr(new Date());
    const snooze = loadSnooze();

    const injuredParts = Object.entries(bodyStatus).filter(
      ([, v]) => v === "sore" || v === "injured"
    );

    // Build alerts using DB-stored firstSeen dates (device-independent)
    const activeAlerts = injuredParts
      .map(([partKey, status]) => {
        // firstSeen comes from DB; fall back to today if not yet recorded
        const firstSeen = bodyStatusDates[partKey] ?? today;

        // Check snooze (stored locally — UI preference only)
        const snoozedUntil = snooze[partKey]?.snoozedUntil;
        if (snoozedUntil && snoozedUntil >= today) return null;

        const daysElapsed = daysBetween(firstSeen, today);
        const config = getAlertConfig(daysElapsed, status);
        return { partKey, status, daysElapsed, config };
      })
      .filter(Boolean) as { partKey: string; status: string; daysElapsed: number; config: AlertConfig }[];

    // Sort: most severe first (injured > sore), then oldest first
    activeAlerts.sort((a, b) => {
      if (a.status !== b.status) return a.status === "injured" ? -1 : 1;
      return b.daysElapsed - a.daysElapsed;
    });

    setAlerts(activeAlerts);
  }, [bodyStatus, bodyStatusDates]);

  const handleDismiss = (partKey: string) => {
    const snooze = loadSnooze();
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 7);
    snooze[partKey] = { snoozedUntil: toDateStr(snoozeDate) };
    saveSnooze(snooze);
    setDismissed((prev) => new Set([...prev, partKey]));
  };

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.partKey));

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {visibleAlerts.map(({ partKey, daysElapsed, config }) => (
        <div
          key={partKey}
          className={`flex items-start gap-3 ${config.bg} border ${config.border} rounded-xl px-4 py-3`}
        >
          <span className="flex-shrink-0 text-base mt-0.5">{config.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-semibold ${config.text} mb-0.5`}>
              {t(PART_I18N[partKey] ?? partKey)} — {t("body.injuryAlert.dayCount", { n: daysElapsed + 1 })}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">{t(config.messageKey)}</p>
          </div>
          <button
            onClick={() => handleDismiss(partKey)}
            className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-md hover:bg-white/5 min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="7日間スヌーズ"
            title="7日間非表示"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

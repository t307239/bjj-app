"use client";

/**
 * InjuryCareAlert — 怪我・筋肉痛のケアアラート（スヌーズ付き）
 *
 * body_statusのsore/injuredパーツを検出し、経過日数に応じたケア提案を表示。
 * ✕で閉じると7日間非表示（スヌーズ）。
 *
 * localStorage key: "bjj_injury_tracking"
 * Format: { [partKey]: { firstSeen: ISO string, snoozedUntil: ISO string | null } }
 */

import { useEffect, useState } from "react";

interface Props {
  bodyStatus: Record<string, string> | null;
}

interface PartTracking {
  firstSeen: string;          // ISO date string (YYYY-MM-DD)
  snoozedUntil: string | null; // ISO date string or null
}

type TrackingMap = Record<string, PartTracking>;

const LS_KEY = "bjj_injury_tracking";

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function loadTracking(): TrackingMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as TrackingMap) : {};
  } catch {
    return {};
  }
}

function saveTracking(map: TrackingMap): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

// ─── Alert config by elapsed days ─────────────────────────────────────────────

interface AlertConfig {
  emoji: string;
  message: string;
  bg: string;
  border: string;
  text: string;
}

function getAlertConfig(daysElapsed: number, status: string): AlertConfig {
  const isInjured = status === "injured";

  if (daysElapsed <= 7) {
    return {
      emoji: "🔴",
      message: isInjured
        ? "怪我の記録があります。スパーリングは控え、今日は無理せずドリルに集中しませんか？"
        : "筋肉痛があります。今日は軽めに、回復を優先しましょう。",
      bg: "bg-red-950/40",
      border: "border-red-500/30",
      text: "text-red-300",
    };
  } else if (daysElapsed <= 21) {
    return {
      emoji: "🟡",
      message: "そろそろ回復してきましたか？モビリティ・ストレッチでしっかりケアしましょう。",
      bg: "bg-yellow-950/40",
      border: "border-yellow-500/30",
      text: "text-yellow-300",
    };
  } else {
    return {
      emoji: "⚪",
      message: "1ヶ月以上痛みが続いています。専門医の受診をお勧めします。",
      bg: "bg-zinc-800/40",
      border: "border-zinc-500/30",
      text: "text-zinc-300",
    };
  }
}

// ─── Part label mapping (simple English — i18n can be extended later) ─────────

const PART_LABELS: Record<string, string> = {
  neck: "Neck", lower_back: "Lower Back",
  left_shoulder: "Left Shoulder", right_shoulder: "Right Shoulder",
  left_elbow: "Left Elbow", right_elbow: "Right Elbow",
  left_wrist: "Left Wrist", right_wrist: "Right Wrist",
  left_hip: "Left Hip", right_hip: "Right Hip",
  left_knee: "Left Knee", right_knee: "Right Knee",
  left_ankle: "Left Ankle", right_ankle: "Right Ankle",
};

// ─── Main component ────────────────────────────────────────────────────────────

export default function InjuryCareAlert({ bodyStatus }: Props) {
  const [alerts, setAlerts] = useState<
    { partKey: string; status: string; daysElapsed: number; config: AlertConfig }[]
  >([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!bodyStatus) return;

    const today = toDateStr(new Date());
    const tracking = loadTracking();

    // Update tracking: add new sore/injured parts, clean up recovered parts
    const injuredParts = Object.entries(bodyStatus).filter(
      ([, v]) => v === "sore" || v === "injured"
    );

    // Add first-seen for newly recorded injuries
    for (const [key] of injuredParts) {
      if (!tracking[key]) {
        tracking[key] = { firstSeen: today, snoozedUntil: null };
      }
    }

    // Remove tracking for parts that are now ok
    for (const key of Object.keys(tracking)) {
      if (!bodyStatus[key] || bodyStatus[key] === "ok") {
        delete tracking[key];
      }
    }

    saveTracking(tracking);

    // Build alerts: skip snoozed
    const activeAlerts = injuredParts
      .map(([partKey, status]) => {
        const track = tracking[partKey];
        if (!track) return null;

        // Check snooze
        if (track.snoozedUntil && track.snoozedUntil >= today) return null;

        const daysElapsed = daysBetween(track.firstSeen, today);
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
  }, [bodyStatus]);

  const handleDismiss = (partKey: string) => {
    const tracking = loadTracking();
    if (tracking[partKey]) {
      // Snooze for 7 days
      const snoozeDate = new Date();
      snoozeDate.setDate(snoozeDate.getDate() + 7);
      tracking[partKey].snoozedUntil = toDateStr(snoozeDate);
      saveTracking(tracking);
    }
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
              {PART_LABELS[partKey] ?? partKey} — Day {daysElapsed + 1}
            </p>
            <p className="text-xs text-zinc-400 leading-relaxed">{config.message}</p>
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

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartStatus = "ok" | "sore" | "injured";
type PartKey =
  | "neck"
  | "left_shoulder" | "right_shoulder"
  | "left_elbow"   | "right_elbow"
  | "left_wrist"   | "right_wrist"
  | "lower_back"
  | "left_hip"     | "right_hip"
  | "left_knee"    | "right_knee"
  | "left_ankle"   | "right_ankle";

type BodyStatus = Partial<Record<PartKey, PartStatus>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CYCLE: PartStatus[] = ["ok", "sore", "injured"];

const STATUS_COLOR: Record<PartStatus, string> = {
  ok:      "#10B981", // green
  sore:    "#F59E0B", // amber
  injured: "#EF4444", // red
};

// Item 18: Default state is "Healthy (Green)" — no ambiguous gray "untouched"
const DEFAULT_COLOR = "#10B981"; // green (ok) — all parts start as healthy

// ─── SVG body part definitions (cx, cy in a 120×260 viewBox) ─────────────────
// Front silhouette: head top ≈ y=5, ankles ≈ y=250
interface BodyPart {
  key: PartKey;
  labelKey: string; // i18n key suffix
  cx: number;
  cy: number;
  r: number;
}

const BODY_PARTS: BodyPart[] = [
  // Neck (between head and shoulders)
  { key: "neck",           labelKey: "body.parts.neck",          cx: 60, cy: 55,  r: 7  },
  // Shoulders
  { key: "left_shoulder",  labelKey: "body.parts.leftShoulder",  cx: 28, cy: 72,  r: 10 },
  { key: "right_shoulder", labelKey: "body.parts.rightShoulder", cx: 92, cy: 72,  r: 10 },
  // Elbows
  { key: "left_elbow",     labelKey: "body.parts.leftElbow",     cx: 17, cy: 110, r: 8  },
  { key: "right_elbow",    labelKey: "body.parts.rightElbow",    cx: 103,cy: 110, r: 8  },
  // Wrists
  { key: "left_wrist",     labelKey: "body.parts.leftWrist",     cx: 12, cy: 145, r: 6  },
  { key: "right_wrist",    labelKey: "body.parts.rightWrist",    cx: 108,cy: 145, r: 6  },
  // Lower back (centre, shown on the torso lower area)
  { key: "lower_back",     labelKey: "body.parts.lowerBack",     cx: 60, cy: 155, r: 9  },
  // Hips
  { key: "left_hip",       labelKey: "body.parts.leftHip",       cx: 40, cy: 175, r: 9  },
  { key: "right_hip",      labelKey: "body.parts.rightHip",      cx: 80, cy: 175, r: 9  },
  // Knees
  { key: "left_knee",      labelKey: "body.parts.leftKnee",      cx: 38, cy: 212, r: 9  },
  { key: "right_knee",     labelKey: "body.parts.rightKnee",     cx: 82, cy: 212, r: 9  },
  // Ankles
  { key: "left_ankle",     labelKey: "body.parts.leftAnkle",     cx: 37, cy: 245, r: 7  },
  { key: "right_ankle",    labelKey: "body.parts.rightAnkle",    cx: 83, cy: 245, r: 7  },
];

// ─── Legend chip ──────────────────────────────────────────────────────────────

function LegendChip({ status, label }: { status: PartStatus; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      <span
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ background: STATUS_COLOR[status] }}
      />
      {label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  userId: string;
  initialStatus?: BodyStatus | null;
  initialDates?: Record<string, string> | null;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BodyHeatmap({ userId, initialStatus, initialDates }: Props) {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const supabase = createClient();

  const [status, setStatus] = useState<BodyStatus>(initialStatus ?? {});
  const [statusDates, setStatusDates] = useState<Record<string, string>>(initialDates ?? {});
  const [savingPart, setSavingPart] = useState<PartKey | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync prop changes (e.g. parent reloads profile)
  useEffect(() => {
    if (initialStatus) setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (initialDates) setStatusDates(initialDates);
  }, [initialDates]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const handlePartClick = useCallback(async (part: PartKey) => {
    if (!isOnline) { showToast(t("body.offlineError")); return; }

    // Item 18: All parts default to Healthy (green). Cycle: unset/ok → sore → injured → (reset to healthy)
    const current = status[part];
    // If unset or "ok", first tap → sore. sore → injured. injured → remove (back to healthy green).
    let next: PartStatus;
    if (!current || current === "ok") {
      next = "sore";
    } else if (current === "sore") {
      next = "injured";
    } else {
      // injured → delete part (back to healthy default)
      const newStatusClean: BodyStatus = { ...status };
      delete newStatusClean[part];
      const newDatesClean = { ...statusDates };
      delete newDatesClean[part];
      setStatus(newStatusClean);
      setStatusDates(newDatesClean);
      setSavingPart(part);
      const { error } = await supabase
        .from("profiles")
        .update({ body_status: newStatusClean, body_status_dates: newDatesClean })
        .eq("id", userId);
      setSavingPart(null);
      if (error) { setStatus(status); setStatusDates(statusDates); showToast(t("body.saveError")); }
      return;
    }

    // Record first-seen date when a part is first marked sore/injured
    const today = toDateStr(new Date());
    const newDates = statusDates[part] ? statusDates : { ...statusDates, [part]: today };

    const newStatus: BodyStatus = { ...status, [part]: next };
    setStatus(newStatus);
    setStatusDates(newDates);
    setSavingPart(part);

    const { error } = await supabase
      .from("profiles")
      .update({ body_status: newStatus, body_status_dates: newDates })
      .eq("id", userId);

    setSavingPart(null);

    if (error) {
      // Revert on error
      setStatus(status);
      setStatusDates(statusDates);
      showToast(t("body.saveError"));
    }
  }, [isOnline, status, userId, supabase, showToast, t]);

  const partColor = (key: PartKey) =>
    status[key] ? STATUS_COLOR[status[key]!] : DEFAULT_COLOR;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
          {t("body.bodyMap")}
        </p>
        {!isOnline && (
          <span className="text-xs text-amber-400">{t("offline.banner").split(".")[0]}</span>
        )}
      </div>

      {/* Legend — item 18: no "Untouched" chip; all parts start green (Healthy) */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <LegendChip status="ok"      label={t("body.status.ok")}      />
        <LegendChip status="sore"    label={t("body.status.sore")}    />
        <LegendChip status="injured" label={t("body.status.injured")} />
        <span className="text-xs text-gray-500 italic">{t("body.status.tapToMark")}</span>
      </div>

      {/* SVG body map */}
      <div className="flex justify-center">
        <svg
          viewBox="0 0 120 265"
          className="w-40 select-none"
          aria-label={t("body.bodyMap")}
        >
          {/* ── Silhouette shapes (non-interactive, dark fill) ── */}
          {/* Head */}
          <ellipse cx="60" cy="28" rx="16" ry="20" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />
          {/* Neck */}
          <rect x="54" y="46" width="12" height="12" rx="4" fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />
          {/* Torso */}
          <path
            d="M32,68 C28,68 20,80 18,100 L14,140 L18,165 L42,165 L42,130 L78,130 L78,165 L102,165 L106,140 L102,100 C100,80 92,68 88,68 Z"
            fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1"
          />
          {/* Left arm */}
          <path d="M28,68 L14,100 L10,130 L10,150 L18,150 L20,130 L22,100 L32,68 Z"
            fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />
          {/* Right arm */}
          <path d="M92,68 L106,100 L110,130 L110,150 L102,150 L100,130 L98,100 L88,68 Z"
            fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />
          {/* Left leg */}
          <path d="M32,165 L28,200 L26,240 L34,255 L44,255 L48,240 L44,200 L42,165 Z"
            fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />
          {/* Right leg */}
          <path d="M88,165 L92,200 L94,240 L86,255 L76,255 L72,240 L76,200 L78,165 Z"
            fill="#1c1c1e" stroke="#3f3f46" strokeWidth="1" />

          {/* ── Interactive body part circles ── */}
          {BODY_PARTS.map((part) => {
            const isSaving = savingPart === part.key;
            const color = partColor(part.key);
            return (
              <g
                key={part.key}
                onClick={() => handlePartClick(part.key)}
                style={{ cursor: isOnline ? "pointer" : "default" }}
                role="button"
                aria-label={t(part.labelKey)}
              >
                <circle
                  cx={part.cx}
                  cy={part.cy}
                  r={part.r + 4}
                  fill="transparent"
                />
                <circle
                  cx={part.cx}
                  cy={part.cy}
                  r={part.r}
                  fill={color}
                  opacity={isSaving ? 0.5 : 1}
                  stroke={color === DEFAULT_COLOR ? "#4b5563" : color}
                  strokeWidth="1.5"
                  className="transition-all duration-200"
                >
                  {isSaving && (
                    <animateTransform
                      attributeName="transform"
                      type="scale"
                      values="1;0.85;1"
                      dur="0.4s"
                      repeatCount="1"
                      additive="sum"
                    />
                  )}
                </circle>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Part status summary */}
      <div className="mt-3 grid grid-cols-2 gap-1">
        {BODY_PARTS.filter((p) => status[p.key] && status[p.key] !== "ok").map((p) => (
          <div
            key={p.key}
            className="flex items-center gap-1.5 text-xs"
          >
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLOR[status[p.key]!] }}
            />
            <span className="text-gray-400 truncate">{t(p.labelKey)}</span>
            <span
              className="ml-auto text-xs font-semibold"
              style={{ color: STATUS_COLOR[status[p.key]!] }}
            >
              {t(`body.status.${status[p.key]}`)}
            </span>
          </div>
        ))}
      </div>

      {/* Tap hint */}
      <p className="text-center text-xs text-gray-500 mt-3">{t("body.tapHint")}</p>

      {toast && (
        <div className="mt-2 text-xs text-center text-green-400 font-medium">{toast}</div>
      )}
    </div>
  );
}

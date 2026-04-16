"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

// ─── Types ────────────────────────────────────────────────────────────────────

type PartStatus = "ok" | "sore" | "injured";
type PartKey =
  | "neck"
  | "chest"
  | "left_shoulder" | "right_shoulder"
  | "left_elbow"   | "right_elbow"
  | "left_wrist"   | "right_wrist"
  | "upper_back"   | "lower_back"
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

type BodyView = "front" | "back";

// ─── SVG body part definitions (cx, cy in a 120×260 viewBox) ─────────────────
interface BodyPart {
  key: PartKey;
  labelKey: string; // i18n key suffix
  cx: number;
  cy: number;
  r: number;
  view: BodyView; // which silhouette this circle appears on
}

const BODY_PARTS: BodyPart[] = [
  // ── Front view ──
  { key: "neck",           labelKey: "body.parts.neck",          cx: 60, cy: 55,  r: 7,  view: "front" },
  { key: "chest",          labelKey: "body.parts.chest",         cx: 60, cy: 90,  r: 10, view: "front" },
  { key: "left_shoulder",  labelKey: "body.parts.leftShoulder",  cx: 28, cy: 72,  r: 10, view: "front" },
  { key: "right_shoulder", labelKey: "body.parts.rightShoulder", cx: 92, cy: 72,  r: 10, view: "front" },
  { key: "left_elbow",     labelKey: "body.parts.leftElbow",     cx: 17, cy: 110, r: 8,  view: "front" },
  { key: "right_elbow",    labelKey: "body.parts.rightElbow",    cx: 103,cy: 110, r: 8,  view: "front" },
  { key: "left_wrist",     labelKey: "body.parts.leftWrist",     cx: 12, cy: 145, r: 6,  view: "front" },
  { key: "right_wrist",    labelKey: "body.parts.rightWrist",    cx: 108,cy: 145, r: 6,  view: "front" },
  { key: "left_hip",       labelKey: "body.parts.leftHip",       cx: 40, cy: 175, r: 9,  view: "front" },
  { key: "right_hip",      labelKey: "body.parts.rightHip",      cx: 80, cy: 175, r: 9,  view: "front" },
  { key: "left_knee",      labelKey: "body.parts.leftKnee",      cx: 38, cy: 212, r: 9,  view: "front" },
  { key: "right_knee",     labelKey: "body.parts.rightKnee",     cx: 82, cy: 212, r: 9,  view: "front" },
  { key: "left_ankle",     labelKey: "body.parts.leftAnkle",     cx: 37, cy: 245, r: 7,  view: "front" },
  { key: "right_ankle",    labelKey: "body.parts.rightAnkle",    cx: 83, cy: 245, r: 7,  view: "front" },
  // ── Back view ──
  { key: "upper_back",     labelKey: "body.parts.upperBack",     cx: 60, cy: 90,  r: 10, view: "back" },
  { key: "lower_back",     labelKey: "body.parts.lowerBack",     cx: 60, cy: 145, r: 9,  view: "back" },
];

// ─── Legend chip ──────────────────────────────────────────────────────────────

function LegendChip({ status, label }: { status: PartStatus; label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs text-zinc-400">
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
  const [view, setView] = useState<BodyView>("front");
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
      // F5: Save resolved injury to localStorage history for recurrence detection
      try {
        const histKey = "bjj_injury_history";
        const raw = localStorage.getItem(histKey);
        const history: { part: string; status: string; startDate: string; endDate: string }[] = raw ? JSON.parse(raw) : [];
        const startDate = statusDates[part] ?? toDateStr(new Date());
        history.unshift({ part, status: current, startDate, endDate: toDateStr(new Date()) });
        // Keep max 50 entries
        if (history.length > 50) history.length = 50;
        localStorage.setItem(histKey, JSON.stringify(history));
      } catch { /* ignore */ }
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
  }, [isOnline, status, statusDates, userId, supabase, showToast, t]);

  const partColor = (key: PartKey) =>
    status[key] ? STATUS_COLOR[status[key]!] : DEFAULT_COLOR;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wide">
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
        <span className="text-xs text-zinc-400 italic">{t("body.status.tapToMark")}</span>
      </div>

      {/* Front / Back view toggle */}
      <div className="flex justify-center gap-1 mb-3">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`px-4 py-1.5 min-h-[44px] rounded-lg text-xs font-medium transition-all duration-200 ${
              view === v
                ? "bg-white/10 text-white border border-white/20"
                : "text-zinc-400 border border-transparent hover:bg-white/5"
            }`}
          >
            {v === "front" ? t("body.viewFront") : t("body.viewBack")}
          </button>
        ))}
      </div>

      {/* SVG body map */}
      <div className="flex justify-center">
        <svg
          viewBox="0 0 120 265"
          className="w-40 select-none"
          aria-label={t("body.bodyMap")}
          style={{ touchAction: "none" }}
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

          {/* Back view label (spine line hint) */}
          {view === "back" && (
            <line x1="60" y1="60" x2="60" y2="165" stroke="#3f3f46" strokeWidth="0.5" strokeDasharray="3,3" />
          )}

          {/* ── Interactive body part circles (filtered by current view) ── */}
          {BODY_PARTS.filter((p) => p.view === view).map((part) => {
            const isSaving = savingPart === part.key;
            const color = partColor(part.key);
            return (
              <g
                key={part.key}
                onPointerUp={(e) => { e.preventDefault(); handlePartClick(part.key); }}
                style={{ cursor: isOnline ? "pointer" : "default", touchAction: "none" }}
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

      {/* Part status summary — show all sore/injured regardless of current view */}
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
            <span className="text-zinc-400 truncate">{t(p.labelKey)}</span>
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
      <p className="text-center text-xs text-zinc-400 mt-3">{t("body.tapHint")}</p>

      {toast && (
        <div className="mt-2 text-xs text-center text-green-400 font-medium">{toast}</div>
      )}
    </div>
  );
}

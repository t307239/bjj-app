"use client";

import React, { useState, useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n";

type CoachMode = "general" | "weakness" | "next_session" | "comp_prep";

type Props = {
  userId: string;
  isPro: boolean;
  /** Pre-loaded from profiles.ai_coach_cache (may be null) */
  initialCoaching?: string | null;
  initialGeneratedAt?: string | null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const MODE_ICONS: Record<CoachMode, string> = {
  general: "🤖",
  weakness: "🔍",
  next_session: "📋",
  comp_prep: "🏆",
};

function parseCoaching(text: string, mode: CoachMode): {
  sections: { label: string; content: string; items?: string[]; highlight?: boolean }[];
} {
  const lines = text.split("\n");
  const sections: { label: string; content: string; items?: string[]; highlight?: boolean }[] = [];

  // Detect section headers based on mode
  const sectionKeys = mode === "general"
    ? ["INSIGHT", "TIPS", "CHALLENGE"]
    : mode === "weakness"
      ? ["ANALYSIS", "WEAKNESSES", "PLAN"]
      : mode === "next_session"
        ? ["FOCUS", "WARMUP", "DRILL", "SPARRING"]
        : ["ASSESSMENT", "GAMEPLAN", "WEEK_BEFORE"];

  for (const key of sectionKeys) {
    const idx = lines.findIndex((l) => l.startsWith(key + ":"));
    if (idx < 0) continue;

    // Find end: next section header or end of text
    const nextIdx = sectionKeys
      .map((k) => lines.findIndex((l, i) => i > idx && l.startsWith(k + ":")))
      .filter((i) => i > idx);
    const end = nextIdx.length > 0 ? Math.min(...nextIdx) : lines.length;

    const block = lines.slice(idx, end);
    const firstLine = block[0].replace(new RegExp(`^${key}:\\s*`), "").trim();

    // Check for bullet items
    const items: string[] = [];
    for (let i = 1; i < block.length; i++) {
      const l = block[i].trim();
      if (l.startsWith("•")) items.push(l.replace(/^•\s*/, "").trim());
    }

    if (items.length > 0) {
      sections.push({ label: key, content: firstLine, items });
    } else {
      const content = firstLine || block.slice(1).map(l => l.trim()).filter(Boolean).join(" ");
      const isHighlight = key === "CHALLENGE" || key === "PLAN" || key === "SPARRING" || key === "WEEK_BEFORE";
      sections.push({ label: key, content, highlight: isHighlight });
    }
  }

  // Fallback if no sections parsed
  if (sections.length === 0) {
    sections.push({ label: "INSIGHT", content: text.slice(0, 300) });
  }

  return { sections };
}

function fmtAge(isoDate: string | null | undefined, locale: string): string {
  if (!isoDate) return "";
  const diffMs = new Date(isoDate).getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86400000);
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (Math.abs(diffDays) < 1) return rtf.format(0, "day");
    return rtf.format(diffDays, "day");
  } catch {
    const days = Math.abs(diffDays);
    return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
  }
}

export default function AICoachCard({ isPro, initialCoaching, initialGeneratedAt }: Props) {
  const { t, locale } = useLocale();
  const [mode, setMode] = useState<CoachMode>("general");
  const [coachingMap, setCoachingMap] = useState<Partial<Record<CoachMode, string>>>(() => {
    if (!initialCoaching) return {};
    // Try parsing multi-mode cache
    try {
      const parsed = JSON.parse(initialCoaching);
      if (typeof parsed === "string") return { general: parsed };
      const map: Partial<Record<CoachMode, string>> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === "object" && "text" in (v as Record<string, unknown>)) {
          map[k as CoachMode] = (v as { text: string }).text;
        }
      }
      return map;
    } catch {
      return { general: initialCoaching };
    }
  });
  const [generatedAtMap, setGeneratedAtMap] = useState<Partial<Record<CoachMode, string>>>(() => {
    if (!initialGeneratedAt) return {};
    return { general: initialGeneratedAt };
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const coaching = coachingMap[mode] ?? null;
  const generatedAt = generatedAtMap[mode] ?? null;
  const isStale = !generatedAt || Date.now() - new Date(generatedAt).getTime() > SEVEN_DAYS_MS;

  const generate = useCallback(async (targetMode: CoachMode) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-coach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, mode: targetMode }),
      });
      const data = await res.json() as {
        coaching?: string;
        generated_at?: string;
        cached?: boolean;
        error?: string;
        mode?: string;
      };
      if (!res.ok || data.error) {
        setError(data.error ?? t("aiCoach.error"));
        return;
      }
      trackEvent("ai_coach_generated", { source: data.cached ? "cache_hit" : "fresh", mode: targetMode });
      if (!data.cached) trackEvent("feature_discovered", { feature: "ai_coach" });
      setCoachingMap((prev) => ({ ...prev, [targetMode]: data.coaching ?? null }));
      setGeneratedAtMap((prev) => ({ ...prev, [targetMode]: data.generated_at ?? null }));
    } catch {
      setError(t("aiCoach.error"));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  const handleModeChange = useCallback((newMode: CoachMode) => {
    setMode(newMode);
    setError(null);
    // Auto-generate if no cached content for this mode
    if (!coachingMap[newMode]) {
      generate(newMode).catch((err) => console.error("ai_coach:auto_generate", err));
    }
  }, [coachingMap, generate]);

  // ── Pro gate ──
  if (!isPro) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🤖</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{t("aiCoach.proDesc")}</p>
          </div>
          <a
            href="/techniques#pro"
            className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
            onClick={() => trackEvent("pro_upgrade_click", { feature: "ai_coach" })}
          >
            {t("common.upgradePro")}
          </a>
        </div>
      </div>
    );
  }

  // ── Mode selector chips ──
  const modes: { key: CoachMode; labelKey: string }[] = [
    { key: "general", labelKey: "aiCoach.modeGeneral" },
    { key: "weakness", labelKey: "aiCoach.modeWeakness" },
    { key: "next_session", labelKey: "aiCoach.modeNextSession" },
    { key: "comp_prep", labelKey: "aiCoach.modeCompPrep" },
  ];

  // ── Empty state — not generated yet ──
  if (!coaching && !loading) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl flex-shrink-0">🤖</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{t("aiCoach.generateDesc")}</p>
          </div>
        </div>
        {/* Mode chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {modes.map((m) => (
            <button
              key={m.key}
              onClick={() => handleModeChange(m.key)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                mode === m.key
                  ? "bg-zinc-700 text-white font-medium"
                  : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <span>{MODE_ICONS[m.key]}</span>
              <span className="whitespace-nowrap">{t(m.labelKey)}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => generate(mode).catch((err) => console.error("ai_coach:generate", err))}
          disabled={loading}
          className="w-full bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? t("aiCoach.generating") : t("aiCoach.generateBtn")}
        </button>
        {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
      </div>
    );
  }

  // ── Loading state ──
  if (loading && !coaching) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{MODE_ICONS[mode]}</span>
          <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
        </div>
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-zinc-800 rounded w-3/4" />
          <div className="h-4 bg-zinc-800 rounded w-1/2" />
          <div className="h-4 bg-zinc-800 rounded w-2/3" />
        </div>
        <p className="text-xs text-zinc-500 mt-3 text-center">{t("aiCoach.generating")}</p>
      </div>
    );
  }

  // ── Show coaching ──
  const parsed = parseCoaching(coaching ?? "", mode);

  return (
    <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{MODE_ICONS[mode]}</span>
          <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-xs text-zinc-500">{fmtAge(generatedAt, locale)}</span>
          )}
          {isStale && (
            <button
              onClick={() => generate(mode).catch((err) => console.error("ai_coach:generate", err))}
              disabled={loading}
              className="text-xs text-[#10B981] hover:text-[#0d9668] disabled:opacity-40 transition-colors"
            >
              {loading ? t("aiCoach.generating") : t("aiCoach.refresh")}
            </button>
          )}
        </div>
      </div>

      {/* Mode chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => handleModeChange(m.key)}
            disabled={loading}
            className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40 ${
              mode === m.key
                ? "bg-[#10B981]/20 text-[#10B981] font-medium border border-[#10B981]/30"
                : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <span>{MODE_ICONS[m.key]}</span>
            <span className="whitespace-nowrap">{t(m.labelKey)}</span>
          </button>
        ))}
      </div>

      {/* Sections */}
      {parsed.sections.map((section, i) => {
        if (section.items) {
          return (
            <div key={i} className="mb-3">
              {section.content && (
                <div className="bg-zinc-800/60 rounded-xl p-3.5 mb-2">
                  <p className="text-sm text-gray-200 leading-relaxed">{section.content}</p>
                </div>
              )}
              <div className="space-y-2">
                {section.items.map((item, j) => (
                  <div key={j} className="flex items-start gap-2">
                    <span className="text-[#10B981] text-sm font-bold flex-shrink-0 mt-0.5">•</span>
                    <p className="text-xs text-zinc-300 leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (section.highlight) {
          return (
            <div key={i} className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-3 mt-3">
              <p className="text-xs font-semibold text-[#10B981] mb-1">
                {section.label === "CHALLENGE" ? "🎯" : section.label === "PLAN" ? "📝" : section.label === "SPARRING" ? "🥊" : "📅"}{" "}
                {t(`aiCoach.section_${section.label.toLowerCase()}`)}
              </p>
              <p className="text-xs text-zinc-300 leading-relaxed">{section.content}</p>
            </div>
          );
        }
        return (
          <div key={i} className="bg-zinc-800/60 rounded-xl p-3.5 mb-3">
            <p className="text-sm text-gray-200 leading-relaxed">{section.content}</p>
          </div>
        );
      })}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

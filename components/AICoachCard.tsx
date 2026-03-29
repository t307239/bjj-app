"use client";

import React, { useState, useCallback } from "react";
import { useLocale } from "@/lib/i18n";

type Props = {
  userId: string;
  isPro: boolean;
  /** Pre-loaded from profiles.ai_coach_cache (may be null) */
  initialCoaching?: string | null;
  initialGeneratedAt?: string | null;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function parseCoaching(text: string): {
  insight: string;
  tips: string[];
  challenge: string;
} {
  const lines = text.split("\n");

  // Extract INSIGHT block
  const insightIdx = lines.findIndex((l) => l.startsWith("INSIGHT:"));
  const tipsIdx = lines.findIndex((l) => l.startsWith("TIPS:"));
  const challengeIdx = lines.findIndex((l) => l.startsWith("CHALLENGE:"));

  let insight = "";
  if (insightIdx >= 0) {
    const end = tipsIdx > insightIdx ? tipsIdx : lines.length;
    insight = lines
      .slice(insightIdx, end)
      .join(" ")
      .replace(/^INSIGHT:\s*/, "")
      .trim();
  } else {
    insight = text.slice(0, 200);
  }

  // Extract TIPS block
  const tips: string[] = [];
  if (tipsIdx >= 0) {
    const end = challengeIdx > tipsIdx ? challengeIdx : lines.length;
    for (let i = tipsIdx + 1; i < end; i++) {
      const l = lines[i].trim();
      if (l.startsWith("•")) tips.push(l.replace(/^•\s*/, "").trim());
    }
  }

  // Extract CHALLENGE block
  let challenge = "";
  if (challengeIdx >= 0) {
    challenge = lines
      .slice(challengeIdx)
      .join(" ")
      .replace(/^CHALLENGE:\s*/, "")
      .trim();
  }

  return { insight, tips, challenge };
}

function fmtAge(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export default function AICoachCard({ isPro, initialCoaching, initialGeneratedAt }: Props) {
  const { t } = useLocale();
  const [coaching, setCoaching] = useState<string | null>(initialCoaching ?? null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isStale = !generatedAt || Date.now() - new Date(generatedAt).getTime() > SEVEN_DAYS_MS;

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-coach/generate", { method: "POST" });
      const data = await res.json() as { coaching?: string; generated_at?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? t("aiCoach.error"));
        return;
      }
      setCoaching(data.coaching ?? null);
      setGeneratedAt(data.generated_at ?? null);
    } catch {
      setError(t("aiCoach.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Pro gate
  if (!isPro) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">🤖</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("aiCoach.proDesc")}</p>
          </div>
          <a
            href="/techniques#pro"
            className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            {t("common.upgradePro")}
          </a>
        </div>
      </div>
    );
  }

  // Empty state — not generated yet
  if (!coaching) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 mb-6">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-2xl flex-shrink-0">🤖</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t("aiCoach.generateDesc")}</p>
          </div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="w-full bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? t("aiCoach.generating") : t("aiCoach.generateBtn")}
        </button>
        {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
      </div>
    );
  }

  // Show coaching
  const parsed = parseCoaching(coaching);

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="text-sm font-semibold text-white">{t("aiCoach.title")}</h3>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-xs text-gray-600">{fmtAge(generatedAt)}</span>
          )}
          {isStale && (
            <button
              onClick={generate}
              disabled={loading}
              className="text-xs text-[#10B981] hover:text-[#0d9668] disabled:opacity-40 transition-colors"
            >
              {loading ? t("aiCoach.generating") : t("aiCoach.refresh")}
            </button>
          )}
        </div>
      </div>

      {/* Insight */}
      <div className="bg-zinc-800/60 rounded-xl p-3.5 mb-3">
        <p className="text-sm text-gray-200 leading-relaxed">{parsed.insight}</p>
      </div>

      {/* Tips */}
      {parsed.tips.length > 0 && (
        <div className="space-y-2 mb-3">
          {parsed.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#10B981] text-sm font-bold flex-shrink-0 mt-0.5">•</span>
              <p className="text-xs text-gray-300 leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>
      )}

      {/* Challenge */}
      {parsed.challenge && (
        <div className="bg-[#10B981]/10 border border-[#10B981]/20 rounded-xl p-3 mt-3">
          <p className="text-xs font-semibold text-[#10B981] mb-1">🎯 {t("aiCoach.challenge")}</p>
          <p className="text-xs text-gray-300 leading-relaxed">{parsed.challenge}</p>
        </div>
      )}

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}

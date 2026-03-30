"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useLocale } from "@/lib/i18n";

const DISMISS_KEY = "bjj_onboarding_dismissed";

type Props = {
  hasFirstLog: boolean;
  hasGoal: boolean;
  hasTechnique: boolean;
  hasSafetyAck?: boolean;
};

type Step = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  emoji: string;
};

const SAFETY_ACK_KEY = "bjj_safety_ack";

export default function OnboardingChecklist({ hasFirstLog, hasGoal, hasTechnique, hasSafetyAck }: Props) {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISS_KEY) === "1";
  });
  const [safetyAcked, setSafetyAcked] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(SAFETY_ACK_KEY) === "1";
  });
  const isSafetyDone = hasSafetyAck || safetyAcked;
  // Item 30: celebration state — "idle" | "celebrating" | "fading" | "done"
  const [celebState, setCelebState] = useState<"idle" | "celebrating" | "fading" | "done">("idle");
  const prevCompletedRef = useRef(0);

  const handleSafetyAck = () => {
    setSafetyAcked(true);
    localStorage.setItem(SAFETY_ACK_KEY, "1");
  };

  const steps: Step[] = [
    {
      id: "safety_ack",
      label: t("onboarding.step.safetyAck"),
      href: "/terms#liability",
      done: isSafetyDone,
      emoji: "⚠️",
    },
    {
      id: "first_log",
      label: t("onboarding.step.firstLog"),
      href: "#training-log",
      done: hasFirstLog,
      emoji: "🥋",
    },
    {
      id: "set_goal",
      label: t("onboarding.step.setGoal"),
      href: hasFirstLog ? "#goal-tracker" : "/profile",
      done: hasGoal,
      emoji: "🎯",
    },
    {
      id: "add_technique",
      label: t("onboarding.step.addTechnique"),
      href: "/techniques",
      done: hasTechnique,
      emoji: "📖",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  // Item 30: Trigger celebration when all steps just completed
  useEffect(() => {
    if (allDone && prevCompletedRef.current < steps.length && celebState === "idle") {
      setCelebState("celebrating");
      const fadeTimer = setTimeout(() => setCelebState("fading"), 2800);
      const doneTimer = setTimeout(() => setCelebState("done"), 3800);
      prevCompletedRef.current = completedCount;
      return () => { clearTimeout(fadeTimer); clearTimeout(doneTimer); };
    }
    prevCompletedRef.current = completedCount;
  }, [allDone, completedCount, steps.length, celebState]);

  // Hide if dismissed or celebration finished
  if (dismissed) return null;
  if (allDone && celebState === "idle") return null;
  if (celebState === "done") return null;

  // Item 30: Celebration card
  if (celebState === "celebrating" || celebState === "fading") {
    return (
      <div
        className="mb-6 rounded-2xl p-5 relative overflow-hidden text-center transition-all duration-1000"
        style={{
          background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
          border: "1px solid rgba(16,185,129,0.5)",
          boxShadow: "0 0 32px rgba(16,185,129,0.25), 0 0 64px rgba(16,185,129,0.1)",
          opacity: celebState === "fading" ? 0 : 1,
        }}
      >
        {/* Sparkle ring */}
        <div className="absolute inset-0 pointer-events-none">
          {["top-2 left-4", "top-3 right-6", "bottom-3 left-8", "bottom-2 right-4", "top-1/2 left-2", "top-1/2 right-2"].map((pos, i) => (
            <span
              key={i}
              className={`absolute text-yellow-300 animate-ping text-xs`}
              style={{ animationDelay: `${i * 150}ms`, animationDuration: "1.2s" }}
            >
              ✦
            </span>
          ))}
        </div>

        <div className="relative z-10">
          <div className="text-4xl mb-2 animate-bounce">🎉</div>
          <p className="text-lg font-bold text-white mb-1">{t("onboarding.celebTitle")}</p>
          <p className="text-sm text-emerald-200">{t("onboarding.celebSubtitle")}</p>
          <div className="mt-3 flex justify-center gap-1">
            {["🥋", "🎯", "📖"].map((e, i) => (
              <span
                key={i}
                className="text-xl"
                style={{ animation: `bounce 0.6s ease ${i * 100}ms infinite alternate` }}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Normal checklist

  return (
    <div className="mb-6 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 relative">
      {/* Dismiss button */}
      <button
        onClick={() => { setDismissed(true); localStorage.setItem(DISMISS_KEY, "1"); }}
        className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-300 transition-colors text-xs p-1"
        aria-label={t("common.dismiss")}
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pr-4">
        <span className="text-base">🚀</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-300">
            {t("onboarding.title")} — {t("onboarding.progress", { done: completedCount, total: steps.length })}
          </p>
          {/* Progress bar */}
          <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#10B981] rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Safety banner (shown until acknowledged) */}
      {!isSafetyDone && (
        <div className="mb-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/30">
          <p className="text-xs text-amber-200 leading-relaxed mb-2">{t("onboarding.safetyBanner")}</p>
          <button
            onClick={handleSafetyAck}
            className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors py-1.5 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 min-h-[36px]"
          >
            {t("common.understood") || "I understand"}
          </button>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step) => (
          step.done ? (
            <div key={step.id} className="flex items-center gap-2.5 px-1 py-2.5 min-h-[44px] opacity-40">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-xs text-emerald-400">✓</span>
              <span className="text-xs text-zinc-500 line-through">{step.emoji} {step.label}</span>
            </div>
          ) : (
            <Link
              key={step.id}
              href={step.href}
              className="flex items-center gap-2.5 px-1 py-2.5 min-h-[44px] rounded-lg hover:bg-emerald-500/10 transition-colors group"
            >
              <span className="w-5 h-5 rounded-full border border-emerald-500/40 flex items-center justify-center shrink-0 group-hover:border-emerald-400 transition-colors" />
              <span className="text-xs text-zinc-300 group-hover:text-emerald-300 transition-colors">
                {step.emoji} {step.label}
              </span>
              <svg className="ml-auto w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )
        ))}
      </div>
    </div>
  );
}

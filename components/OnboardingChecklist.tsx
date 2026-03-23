"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  hasFirstLog: boolean;
  hasGoal: boolean;
  hasTechnique: boolean;
};

type Step = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  emoji: string;
};

export default function OnboardingChecklist({ hasFirstLog, hasGoal, hasTechnique }: Props) {
  const [dismissed, setDismissed] = useState(false);

  const steps: Step[] = [
    {
      id: "first_log",
      label: "Log your first training session",
      href: "#training-log",
      done: hasFirstLog,
      emoji: "🥋",
    },
    {
      id: "set_goal",
      label: "Set your weekly training goal",
      href: "/profile",
      done: hasGoal,
      emoji: "🎯",
    },
    {
      id: "add_technique",
      label: "Add a technique to your library",
      href: "/techniques",
      done: hasTechnique,
      emoji: "📖",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const remaining = steps.filter((s) => !s.done);

  if (completedCount === steps.length || dismissed) return null;

  return (
    <div className="mb-6 bg-blue-950/40 border border-blue-500/30 rounded-2xl p-4 relative">
      {/* Dismiss button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-400 transition-colors text-xs p-1"
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pr-4">
        <span className="text-base">🚀</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-blue-300">
            Getting Started — {completedCount}/{steps.length} complete
          </p>
          {/* Progress bar */}
          <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {steps.map((step) => (
          step.done ? (
            <div key={step.id} className="flex items-center gap-2.5 px-1 py-1.5 opacity-40">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-[10px] text-blue-400">✓</span>
              <span className="text-xs text-zinc-500 line-through">{step.emoji} {step.label}</span>
            </div>
          ) : (
            <Link
              key={step.id}
              href={step.href}
              className="flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-blue-500/10 transition-colors group"
            >
              <span className="w-5 h-5 rounded-full border border-blue-500/40 flex items-center justify-center shrink-0 group-hover:border-blue-400 transition-colors" />
              <span className="text-xs text-zinc-300 group-hover:text-blue-300 transition-colors">
                {step.emoji} {step.label}
              </span>
              <svg className="ml-auto w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )
        ))}
      </div>
    </div>
  );
}

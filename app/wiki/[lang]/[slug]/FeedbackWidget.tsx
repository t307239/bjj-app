"use client";

import { useState } from "react";

/**
 * #31: Feedback Widget
 * "Was this helpful? 👍 / 👎" — UI only.
 * Clicking either button shows a thank-you message.
 */
export default function FeedbackWidget({ lang }: { lang: string }) {
  const [voted, setVoted] = useState<"up" | "down" | null>(null);

  const labels = {
    en: {
      question: "Was this article helpful?",
      yes: "Yes",
      no: "No",
      thanks: "Thanks for your feedback!",
    },
    ja: {
      question: "この記事は役に立ちましたか？",
      yes: "はい",
      no: "いいえ",
      thanks: "フィードバックありがとうございます！",
    },
    pt: {
      question: "Este artigo foi útil?",
      yes: "Sim",
      no: "Não",
      thanks: "Obrigado pelo seu feedback!",
    },
  };

  const l = labels[lang as keyof typeof labels] ?? labels.en;

  if (voted) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400 border-t border-slate-800/60">
        <span className="text-base">{voted === "up" ? "👍" : "👎"}</span>
        <span>{l.thanks}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 py-4 border-t border-slate-800/60">
      <span className="text-sm text-slate-400 shrink-0">{l.question}</span>
      <div className="flex gap-2">
        <button
          onClick={() => setVoted("up")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-pink-500"
        >
          👍 {l.yes}
        </button>
        <button
          onClick={() => setVoted("down")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-pink-500"
        >
          👎 {l.no}
        </button>
      </div>
    </div>
  );
}

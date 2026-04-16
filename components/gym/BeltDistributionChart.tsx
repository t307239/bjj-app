"use client";

import { useLocale } from "@/lib/i18n";
import { type MemberRow } from "./types";

export default function BeltDistributionChart({ members }: { members: MemberRow[] }) {
  const { t } = useLocale();
  const BELTS = ["white", "blue", "purple", "brown", "black"];
  const counts: Record<string, number> = {};
  for (const b of BELTS) counts[b] = 0;
  for (const m of members) {
    const b = m.belt ?? "white";
    counts[b] = (counts[b] ?? 0) + 1;
  }
  const max = Math.max(...Object.values(counts), 1);

  const BELT_LABELS: Record<string, string> = {
    white: t("profile.belts.white"),
    blue: t("profile.belts.blue"),
    purple: t("profile.belts.purple"),
    brown: t("profile.belts.brown"),
    black: t("profile.belts.black"),
  };

  const BELT_BG: Record<string, string> = {
    white: "bg-gray-400",
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    brown: "bg-amber-800",
    black: "bg-zinc-800 border border-zinc-600",
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-3">{t("gym.beltDistribution")}</h3>
      <div className="space-y-2">
        {BELTS.map((belt) => (
          <div key={belt} className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 w-12">{BELT_LABELS[belt]}</span>
            <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${BELT_BG[belt]}`}
                style={{ width: `${(counts[belt] / max) * 100}%`, minWidth: counts[belt] > 0 ? "8px" : "0" }}
              />
            </div>
            <span className="text-xs text-zinc-400 w-4 text-right">{counts[belt]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

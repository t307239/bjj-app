"use client";

import { Panel } from "@xyflow/react";
import { useLocale } from "@/lib/i18n";

export default function SkillMapLegend() {
  const { t } = useLocale();
  return (
    <Panel position="bottom-right">
      <div className="flex items-center gap-2.5 bg-zinc-900/80 border border-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none select-none">
        {[
          { key: "locked",   label: t("skillmap.legendLocked"),   cls: "border-zinc-600 bg-zinc-700/60" },
          { key: "learning", label: t("skillmap.legendLearning"), cls: "border-blue-500/70 bg-blue-900/40" },
          { key: "mastered", label: t("skillmap.legendMastered"), cls: "border-emerald-500/70 bg-emerald-900/40" },
        ].map(({ key, label, cls }) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm border ${cls} inline-block`} />
            <span className="text-xs text-zinc-400">{label}</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

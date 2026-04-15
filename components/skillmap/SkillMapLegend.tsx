"use client";

import { Panel } from "@xyflow/react";

export default function SkillMapLegend() {
  return (
    <Panel position="bottom-right">
      <div className="flex items-center gap-2.5 bg-zinc-900/80 border border-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 pointer-events-none select-none">
        {[
          { label: "Locked",   cls: "border-zinc-600 bg-zinc-700/60" },
          { label: "Learning", cls: "border-blue-500/70 bg-blue-900/40" },
          { label: "Mastered", cls: "border-emerald-500/70 bg-emerald-900/40" },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm border ${cls} inline-block`} />
            <span className="text-xs text-zinc-400">{label}</span>
          </span>
        ))}
      </div>
    </Panel>
  );
}

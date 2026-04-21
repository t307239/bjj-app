"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import { useLocale } from "@/lib/i18n";

export default function CustomZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { t } = useLocale();
  return (
    <Panel position="bottom-left">
      <div className="flex flex-col gap-1 bg-zinc-900/80 border border-white/10 backdrop-blur-sm rounded-lg p-1">
        <button type="button"
          onClick={() => zoomIn({ duration: 200 })}
          className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded-md transition-all text-base leading-none"
          aria-label={t("common.zoomIn")}
          title={t("common.zoomIn")}
        >+</button>
        <button type="button"
          onClick={() => zoomOut({ duration: 200 })}
          className="w-7 h-7 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-700/60 rounded-md transition-all text-base leading-none"
          aria-label={t("common.zoomOut")}
          title={t("common.zoomOut")}
        >−</button>
        <button type="button"
          onClick={() => fitView({ padding: 0.15, duration: 400 })}
          className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/60 rounded-md transition-all"
          aria-label={t("common.fitView")}
          title={t("common.fitView")}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </Panel>
  );
}

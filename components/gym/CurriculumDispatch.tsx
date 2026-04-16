"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";
import { type Gym } from "./types";

// ─── Curriculum template definitions (B-34) ──────────────────────────────────

type TemplateLevel = "white" | "blue" | "purple";

const CURRICULUM_TEMPLATES: { level: TemplateLevel; labelKey: string; slug: string }[] = [
  { level: "white",  labelKey: "curriculumTemplateClosedGuard",  slug: "closed-guard" },
  { level: "white",  labelKey: "curriculumTemplateMountBasics",  slug: "mount" },
  { level: "white",  labelKey: "curriculumTemplateSideControl",  slug: "side-control" },
  { level: "white",  labelKey: "curriculumTemplateRnc",          slug: "rear-naked-choke" },
  { level: "white",  labelKey: "curriculumTemplateGuardPassing", slug: "guard-passing" },
  { level: "blue",   labelKey: "curriculumTemplateTriangle",     slug: "triangle-choke" },
  { level: "blue",   labelKey: "curriculumTemplateArmbar",       slug: "armbar" },
  { level: "blue",   labelKey: "curriculumTemplateBackControl",  slug: "back-control" },
  { level: "blue",   labelKey: "curriculumTemplateOpenGuard",    slug: "open-guard" },
  { level: "purple", labelKey: "curriculumTemplateLegLocks",     slug: "leg-locks" },
  { level: "purple", labelKey: "curriculumTemplateTurtle",       slug: "turtle-position" },
];

const LEVEL_LABELS: Record<TemplateLevel, string> = {
  white:  "curriculumTemplateWhite",
  blue:   "curriculumTemplateBlue",
  purple: "curriculumTemplatePurple",
};

const LEVEL_COLORS: Record<TemplateLevel, string> = {
  white:  "bg-zinc-700/60 hover:bg-zinc-600/60 text-gray-200 border-zinc-600/40",
  blue:   "bg-blue-900/40 hover:bg-blue-800/40 text-blue-200 border-blue-700/40",
  purple: "bg-purple-900/40 hover:bg-purple-800/40 text-purple-200 border-purple-700/40",
};

type Props = {
  gym: Gym;
  onUpgradeClick: () => void;
  upgrading: boolean;
  isGymPro: boolean;
};

export default function CurriculumDispatch({ gym, onUpgradeClick, upgrading, isGymPro }: Props) {
  const { t, locale } = useLocale();
  const [url, setUrl] = useState(gym.curriculum_url ?? "");
  const [dispatching, setDispatching] = useState(false);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<string | null>(gym.curriculum_set_at ?? null);

  const wikiLang = locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en";
  const wikiBase = `https://wiki.bjj-app.net/${wikiLang}`;

  const dispatch = async () => {
    setConfirmDispatch(false);
    setDispatching(true);
    try {
      const res = await fetch("/api/gym/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculum_url: url.trim() }),
      });
      if (res.ok) {
        setLastSentAt(new Date().toISOString());
      }
    } finally {
      setDispatching(false);
    }
  };

  if (!isGymPro) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📚</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{t("gym.curriculumTitle")}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t("gym.curriculumProRequired")}</p>
          </div>
          <button
            onClick={onUpgradeClick}
            disabled={upgrading}
            className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 disabled:opacity-60 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            {upgrading ? "..." : t("gym.upgradeBtn")}
          </button>
        </div>
      </div>
    );
  }

  const sentAgo = lastSentAt
    ? (() => {
        const d = Math.floor((Date.now() - new Date(lastSentAt).getTime()) / 86400000);
        if (d === 0) return t("gym.today");
        if (d === 1) return t("gym.yesterday");
        return t("gym.daysAgo", { n: d });
      })()
    : null;

  const levels: TemplateLevel[] = ["white", "blue", "purple"];

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-1">📚 {t("gym.curriculumTitle")}</h3>
      <p className="text-xs text-zinc-400 mb-3">{t("gym.curriculumDesc")}</p>

      {/* B-34: 1-Click Template Picker */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">
          {t("gym.curriculumTemplatesLabel")}
        </p>
        {levels.map((level) => (
          <div key={level} className="mb-1.5">
            <span className="text-[10px] text-zinc-500 mr-1.5">{t(`gym.${LEVEL_LABELS[level]}`)}</span>
            {CURRICULUM_TEMPLATES.filter((tpl) => tpl.level === level).map((tpl) => (
              <button
                key={tpl.slug}
                onClick={() => { setUrl(`${wikiBase}/${tpl.slug}`); setConfirmDispatch(false); }}
                className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded border mr-1 mb-1 transition-colors ${LEVEL_COLORS[level]}`}
              >
                {t(`gym.${tpl.labelKey}`)}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setConfirmDispatch(false); }}
          placeholder={`${wikiBase}/...`}
          className="flex-1 bg-zinc-800 text-xs text-zinc-300 placeholder-gray-500 px-3 py-2 rounded-lg border border-white/10 focus:outline-none focus:border-white/30"
        />
        <button
          onClick={() => { if (!url.trim()) return; setConfirmDispatch(true); }}
          disabled={dispatching || !url.trim() || confirmDispatch}
          className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
        >
          {dispatching ? t("gym.curriculumSending") : t("gym.curriculumDispatch")}
        </button>
      </div>
      {/* Inline dispatch confirmation */}
      {confirmDispatch && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-blue-400">{t("gym.curriculumConfirm")}</span>
          <button
            onClick={dispatch}
            disabled={dispatching}
            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            {t("gym.confirmYes")}
          </button>
          <button
            onClick={() => setConfirmDispatch(false)}
            className="text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            {t("training.cancel")}
          </button>
        </div>
      )}
      {sentAgo && (
        <p className="text-xs text-zinc-400 mt-2">
          {t("gym.curriculumLastSent", { text: sentAgo })}
        </p>
      )}
    </div>
  );
}

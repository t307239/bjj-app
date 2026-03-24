"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n";

const AFF_CODE = "bjjapp";
const BASE = "https://bjjfanatics.com/products";

type LevelKey = "intermediate_advanced" | "all" | "intermediate";

const PRODUCTS: { id: string; title: string; instructor: string; levelKey: LevelKey; category: string; url: string; emoji: string }[] = [
  {
    id: "danaher-leg-locks",
    title: "Leg Locks: Enter the System",
    instructor: "John Danaher",
    levelKey: "intermediate_advanced",
    category: "submissions",
    url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`,
    emoji: "🦵",
  },
  {
    id: "bernardo-half-guard",
    title: "Half Guard: A Complete System",
    instructor: "Bernardo Faria",
    levelKey: "all",
    category: "guard",
    url: `${BASE}/half-guard-a-complete-system-by-bernardo-faria?aff=${AFF_CODE}`,
    emoji: "🛡️",
  },
  {
    id: "marcelo-butterfly",
    title: "Advanced Butterfly Guard",
    instructor: "Marcelo Garcia",
    levelKey: "intermediate",
    category: "guard",
    url: `${BASE}/advanced-butterfly-guard-by-marcelo-garcia?aff=${AFF_CODE}`,
    emoji: "🦋",
  },
  {
    id: "gordon-wrestling",
    title: "The Wrestling System",
    instructor: "Gordon Ryan",
    levelKey: "all",
    category: "takedowns",
    url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`,
    emoji: "🤼",
  },
  {
    id: "danaher-back-attacks",
    title: "Back Attacks: Enter the System",
    instructor: "John Danaher",
    levelKey: "intermediate_advanced",
    category: "back",
    url: `${BASE}/back-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`,
    emoji: "🎯",
  },
  {
    id: "tom-deblass-escape",
    title: "Escape From Everywhere",
    instructor: "Tom DeBlass",
    levelKey: "all",
    category: "escapes",
    url: `${BASE}/escape-from-everywhere-by-tom-deblass?aff=${AFF_CODE}`,
    emoji: "🔓",
  },
];

const CATEGORY_KEYS = ["all", "guard", "submissions", "takedowns", "back", "escapes"] as const;

export default function AffiliateSection() {
  const { t } = useLocale();
  const [filterCat, setFilterCat] = useState("all");

  const filtered = filterCat === "all"
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === filterCat);

  return (
    <section className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">📼 {t("affiliate.title")}</h2>
          <span className="text-[10px] bg-white/10 text-gray-400 px-2 py-0.5 rounded-full">PR</span>
        </div>
        <a
          href={`https://bjjfanatics.com?aff=${AFF_CODE}`}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          {t("affiliate.viewAll")}
        </a>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {CATEGORY_KEYS.map((val) => (
          <button
            key={val}
            onClick={() => setFilterCat(val)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              filterCat === val
                ? "bg-orange-500/80 text-white"
                : "bg-zinc-900 text-gray-400 border border-white/10 hover:border-orange-500/40"
            }`}
          >
            {t(`affiliate.cat.${val}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="flex items-center gap-3 bg-zinc-900 hover:bg-white/5 rounded-xl p-3 border border-white/10 hover:border-orange-500/30 transition-all group"
          >
            <div className="text-2xl flex-shrink-0">{p.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-orange-300 transition-colors truncate leading-tight">
                {p.title}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{p.instructor}</div>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] bg-white/10 text-gray-400 px-1.5 py-0.5 rounded">
                {t(`affiliate.level.${p.levelKey}`)}
              </span>
              <div className="text-orange-400 text-[10px] mt-1">
                {t("affiliate.view")}
              </div>
            </div>
          </a>
        ))}
      </div>
      <p className="text-[9px] text-gray-600 text-center mt-2">
        {t("affiliate.disclaimer")}
      </p>
    </section>
  );
}

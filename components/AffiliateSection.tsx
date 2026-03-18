"use client";

import { useState } from "react";

const AFF_CODE = "bjjapp";
const BASE = "https://bjjfanatics.com/products";

const PRODUCTS = [
  {
    id: "danaher-leg-locks",
    title: "Leg Locks: Enter the System",
    instructor: "John Danaher",
    level: "中〜上級",
    category: "submissions",
    url: `${BASE}/leg-locks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`,
    emoji: "🦵",
  },
  {
    id: "bernardo-half-guard",
    title: "Half Guard: A Complete System",
    instructor: "Bernardo Faria",
    level: "全レベル",
    category: "guard",
    url: `${BASE}/half-guard-a-complete-system-by-bernardo-faria?aff=${AFF_CODE}`,
    emoji: "🛡️",
  },
  {
    id: "marcelo-butterfly",
    title: "Advanced Butterfly Guard",
    instructor: "Marcelo Garcia",
    level: "中級",
    category: "guard",
    url: `${BASE}/advanced-butterfly-guard-by-marcelo-garcia?aff=${AFF_CODE}`,
    emoji: "🦋",
  },
  {
    id: "gordon-wrestling",
    title: "The Wrestling System",
    instructor: "Gordon Ryan",
    level: "全レベル",
    category: "takedowns",
    url: `${BASE}/the-wrestling-system-by-gordon-ryan?aff=${AFF_CODE}`,
    emoji: "🤼",
  },
  {
    id: "danaher-back-attacks",
    title: "Back Attacks: Enter the System",
    instructor: "John Danaher",
    level: "中〜上級",
    category: "back",
    url: `${BASE}/back-attacks-enter-the-system-by-john-danaher?aff=${AFF_CODE}`,
    emoji: "🎯",
  },
  {
    id: "tom-deblass-escape",
    title: "Escape From Everywhere",
    instructor: "Tom DeBlass",
    level: "全レベル",
    category: "escapes",
    url: `${BASE}/escape-from-everywhere-by-tom-deblass?aff=${AFF_CODE}`,
    emoji: "🔓",
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  all: "すべて",
  guard: "ガード",
  submissions: "サブミッション",
  takedowns: "テイクダウン",
  back: "バック",
  escapes: "エスケープ",
};

export default function AffiliateSection() {
  const [filterCat, setFilterCat] = useState("all");

  const filtered = filterCat === "all"
    ? PRODUCTS
    : PRODUCTS.filter((p) => p.category === filterCat);

  return (
    <section className="mt-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">📼 おすすめインストラクショナル</h2>
          <span className="text-[10px] bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">PR</span>
        </div>
        <a
          href={`https://bjjfanatics.com?aff=${AFF_CODE}`}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          すべて見る →
        </a>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
        {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterCat(val)}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              filterCat === val
                ? "bg-orange-500/80 text-white"
                : "bg-[#16213e] text-gray-400 border border-gray-700 hover:border-orange-500/40"
            }`}
          >
            {label}
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
            className="flex items-center gap-3 bg-[#16213e] hover:bg-[#1a2a4a] rounded-xl p-3 border border-gray-700/60 hover:border-orange-500/30 transition-all group"
          >
            <div className="text-2xl flex-shrink-0">{p.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white group-hover:text-orange-300 transition-colors truncate leading-tight">
                {p.title}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{p.instructor}</div>
            </div>
            <div className="flex-shrink-0 text-right">
              <span className="text-[10px] bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded">
                {p.level}
              </span>
              <div className="text-orange-400 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                見る →
              </div>
            </div>
          </a>
        ))}
      </div>
      <p className="text-[9px] text-gray-600 text-center mt-2">
        ※ リンク先はBJJ Fanatics（アフィリエイト広告）
      </p>
    </section>
  );
}

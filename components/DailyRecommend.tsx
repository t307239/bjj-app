"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string };
type Technique = {
  id: string;
  name: string;
  category: string;
  mastery_level: number;
};

const MASTERY_LABELS: Record<number, string> = {
  1: "入門",
  2: "基礎",
  3: "中級",
  4: "上級",
  5: "マスター",
};

const CATEGORY_LABELS: Record<string, string> = {
  guard: "ガード",
  passing: "パス",
  submissions: "サブミッション",
  takedowns: "テイクダc��ン",
  escapes: "エスケープ",
  back: "バック",
  mount: "マウント",
  other: "その他",
};

const TIPS = [
  "今日はポジショナルスパーに集中してみよう。タップより位置取りを意識！",
  "新しいテクニックを覚えたら、必ずドリルで50回繰り返して定着させよう。",
  "防御は攻撃と同じくらい重要。今日は防御ポジションを意識してみよ。",
  "試合のつもりでロールしてみよう。プレッシャーに慣れることが大切。",
  "上位者とのロールでは、タッョを恐れずポジション改善にフォーカス！",
  "今日のテクニックを言語化してみよう。説明できれば本当に理解している証拠。",
  "疲れた日ほど基本技術の精度を上げるチャンス。焦らず丁寧に動こう。",
];

export default function DailyRecommend({ userId }: Props) {
  const [tech, setTech] = useState<Technique | null>(null);
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("techniques")
        .select("id, name, category, mastery_level")
        .eq("user_id", userId)
        .order("mastery_level", { ascending: true })
        .limit(10);

      if (data && data.length > 0) {
        // 日付ベースで候補をローテーション（毎日変わる）
        const dayIndex = new Date().getDate() % data.length;
        setTech(data[dayIndex]);
      }

      // 今日のヒント（年の通算日でローテーション）
      const now = new Date();
      const dayOfYear = Math.floor(
        (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000
      );
      setTip(TIPS[dayOfYear % TIPS.length]);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-[#16213e] rounded-xl p-4 mb-4 animate-pulse border border-gray-700">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-3" />
        <div className="h-3 bg-gray-700 rounded w-2/3 mb-2" />
        <div className="h-3 bg-gray-700 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-3">
      {/* 今日のおすすめテクニック */}
      {tech && (
        <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] rounded-xl p-4 border border-[#e94560]/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-semibold text-[#e94560] uppercase tracking-wider">
              今日の練習テーマ
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{tech.name}</p>
              <p className="text-gray-400 text-xs mt-0.5">{CATEGORY_LABELS[tech.category] ?? tech.category}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* YouTubeクイック検索ボタン */}
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(tech.name + " BJJ tutorial")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/20 hover:bg-red-600/40 transition-colors"
                title="YouTube で検索"
              >
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <div className="text-right">
                <span className="bg-[#e94560]/20 text-[#e94560] text-xs px-2 py-1 rounded-full">
                  {MASTERY_LABELS[tech.mastery_level] ?? "入門"}
                </span>
                <p className="text-gray-500 text-[10px] mt-1">習熟度を上げよう</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 今日のトレーニングヒント */}
      <div className="bg-[#16213e] rounded-xl p-4 border border-yellow-400/20">
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5">💡</span>
          <div>
            <p className="text-xs font-semibold text-yellow-400 mb-1">
              今日のヒント
            </p>
            <p className="text-gray-300 text-xs leading-relaxed">{tip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

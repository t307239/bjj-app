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

const TIPS = [
  "今日はドリルに時間を使ってみよう",
  "スパーで積極的に新しい技を試してみよう",
  "動画を見てイメージトレーニングも有効",
  "試合映像を分析して自分のゲームプランを練ろう",
  "パートナーと特定ポジションの攻防を集中練習しよう",
  "基礎動作（シュリンプ・ブリッジ）を丁寧に繰り返そう",
  "連続攻撃のコンビネーションを体に染み込ませよう",
];

export default function DailyRecommend({ userId }: Props) {
  const [tech, setTech] = useState<Technique | null>(null);
  const [tip, setTip] = useState("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // 習熟度が低いテクニックをおすすめ
      const { data } = await supabase
        .from("techniques")
        .select("id, name, category, mastery_level")
        .eq("user_id", userId)
        .order("mastery_level", { ascending: true })
        .limit(10);

      if (data && data.length > 0) {
        // 上位3件からランダムに選ぶ（毎日変化感を出す）
        const candidates = data.slice(0, Math.min(3, data.length));
        const dayIdx = new Date().getDate() % candidates.length;
        setTech(candidates[dayIdx]);
      }

      // 日付ベースで固定Tip（毎日変わる）
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
      );
      setTip(TIPS[dayOfYear % TIPS.length]);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;

  const masteryLabel = ["", "入門", "基礎", "中級", "上級", "マスター"];
  const masteryColor = ["", "text-gray-400", "text-blue-400", "text-yellow-400", "text-orange-400", "text-green-400"];

  return (
    <div className="bg-[#16213e] rounded-xl border border-gray-700 mb-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700/50">
        <h4 className="text-sm font-medium text-gray-300">💡 今日のおすすめ</h4>
      </div>
      <div className="p-4 space-y-3">
        {tech ? (
          <div className="bg-gray-800/40 rounded-xl px-4 py-3">
            <p className="text-[11px] text-gray-500 mb-1">練習する技</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{tech.name}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{tech.category}</p>
              </div>
              <span className={`text-xs font-medium ${masteryColor[tech.mastery_level] || "text-gray-400"}`}>
                {masteryLabel[tech.mastery_level] || "入門"}
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-800/40 rounded-xl px-4 py-3">
            <p className="text-[11px] text-gray-500 mb-1">今日のフォーカス</p>
            <p className="text-sm text-gray-300">テクニック帳に技を登録すると、練習おすすめが表示されます</p>
          </div>
        )}
        <div className="bg-[#e94560]/5 border border-[#e94560]/20 rounded-xl px-4 py-3">
          <p className="text-[11px] text-[#e94560] mb-1">今日のヒント</p>
          <p className="text-xs text-gray-300">{tip}</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { getLocalDateParts } from "@/lib/timezone";

type Props = { userId: string };
type Technique = {
  id: string;
  name: string;
  category: string;
  mastery_level: number;
};

const MASTERY_LABELS: Record<number, Record<string, string>> = {
  1: { en: "Know it", ja: "入門" },
  2: { en: "Practicing", ja: "基礎" },
  3: { en: "Can do it", ja: "中級" },
  4: { en: "Good at it", ja: "上級" },
  5: { en: "Mastered", ja: "マスター" },
};

const CATEGORY_LABELS: Record<string, Record<string, string>> = {
  guard: { en: "Guard", ja: "ガード" },
  passing: { en: "Passing", ja: "パス" },
  submissions: { en: "Submission", ja: "サブミッション" },
  takedowns: { en: "Takedown", ja: "テイクダウン" },
  escapes: { en: "Escape", ja: "エスケープ" },
  back: { en: "Back", ja: "バック" },
  mount: { en: "Mount", ja: "マウント" },
  other: { en: "Other", ja: "その他" },
};

// Chewjitsu (Knight Jiu-Jitsu) チャンネルの主要テクニック動画マッピング
// キーは正規化済み（小文字・スペース区切り）
const YOUTUBE_VIDEO_MAP: Record<string, string> = {
  // English names
  "triangle choke": "9pjdpFCr4UI",
  "triangle": "9pjdpFCr4UI",
  "armbar": "XUrxSihViJI",
  "arm bar": "XUrxSihViJI",
  "kimura": "mVkKOPNGvjA",
  "guillotine": "UbcqJETDUY8",
  "guillotine choke": "UbcqJETDUY8",
  "rear naked choke": "xVdg4Mi1W8w",
  "rnc": "xVdg4Mi1W8w",
  "hip bump sweep": "KXCdU94TRic",
  "hip bump": "KXCdU94TRic",
  "scissor sweep": "UBf7uF5x8GQ",
  "omoplata": "bNYr8KPao9A",
  "guard pass": "o5L_bmRcfow",
  "back take": "CvhI6U-IN_8",
  "back mount": "CvhI6U-IN_8",
  // Japanese names
  "トライアングルチョーク": "9pjdpFCr4UI",
  "三角絞め": "9pjdpFCr4UI",
  "アームバー": "XUrxSihViJI",
  "腕十字": "XUrxSihViJI",
  "キムラ": "mVkKOPNGvjA",
  "キムラロック": "mVkKOPNGvjA",
  "ギロチンチョーク": "UbcqJETDUY8",
  "裸絞め": "xVdg4Mi1W8w",
  "リアネイキッドチョーク": "xVdg4Mi1W8w",
  "ヒップバンプスウィープ": "KXCdU94TRic",
  "シザースウィープ": "UBf7uF5x8GQ",
  "オモプラータ": "bNYr8KPao9A",
  "ガードパス": "o5L_bmRcfow",
  "バックテイク": "CvhI6U-IN_8",
};

// テクニック名からYouTube URLを生成（直リンク優先、なければチャンネル内検索）
function getYouTubeUrl(techName: string): string {
  const normalized = techName.trim().toLowerCase();
  const videoId = YOUTUBE_VIDEO_MAP[normalized] ?? YOUTUBE_VIDEO_MAP[techName.trim()];
  if (videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }
  // フォールバック: Chewjitsuチャンネル内検索（汎用検索より精度高）
  return `https://www.youtube.com/@chewjitsu/search?query=${encodeURIComponent(techName + " BJJ tutorial")}`;
}

type Tip = { en: string; ja: string };

const TIPS: Tip[] = [
  { en: "Focus on positional sparring today. Prioritize position over tapping!", ja: "今日はポジショナルスパーに集中してみよう。タップより位置取りを意識！" },
  { en: "When learning a new technique, drill it 50 times to solidify the movement.", ja: "新しいテクニックを覚えたら、必ずドリルで50回繰り返して定着させよう。" },
  { en: "Defense is just as important as offense. Focus on defensive positions today.", ja: "防御は攻撃と同じくらい重要。今日は防御ポジションを意識してみよう。" },
  { en: "Roll as if you're in competition. Getting used to pressure is key.", ja: "試合のつもりでロールしてみよう。プレッシャーに慣れることが大切。" },
  { en: "Rolling with higher-level partners: focus on position improvement, not tapping.", ja: "上位者とのロールでは、タップを恐れずポジション改善にフォーカス！" },
  { en: "Verbalize the technique you're learning today. If you can explain it, you truly understand it.", ja: "今日のテクニックを言語化してみよう。説明できれば本当に理解している証拠。" },
  { en: "When tired, focus on perfecting fundamental techniques with precision.", ja: "疲れた日ほど基本技術の精度を上げるチャンス。焦らず丁寧に動こう。" },
];

export default function DailyRecommend({ userId }: Props) {
  const { t } = useLocale();
  const [tech, setTech] = useState<Technique | null>(null);
  const [tipIndex, setTipIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("techniques")
          .select("id, name, category, mastery_level")
          .eq("user_id", userId)
          .order("mastery_level", { ascending: true })
          .limit(10);

        if (data && data.length > 0) {
          // Rotate candidates by local date (changes daily in user's timezone)
          const { day } = getLocalDateParts();
          const dayIndex = day % data.length;
          setTech(data[dayIndex]);
        }
      } catch {
        // Network/auth error — show tip only (tech stays null)
      } finally {
        // Rotate tip by day-of-year in user's local timezone
        const { year, month, day } = getLocalDateParts();
        const startOfYear = new Date(Date.UTC(year, 0, 1));
        const today = new Date(Date.UTC(year, month - 1, day));
        const dayOfYear = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000) + 1;
        setTipIndex(dayOfYear % TIPS.length);
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 mb-4 animate-pulse border border-white/10">
        <div className="h-4 bg-white/10 rounded w-1/3 mb-3" />
        <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
      </div>
    );
  }

  const tip = TIPS[tipIndex];

  return (
    <div className="mb-4">
      {/* アコーディオンヘッダー */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-zinc-900 hover:bg-white/5 rounded-xl px-4 py-3 border border-white/10 transition-colors active:scale-95 transform"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">🎯</span>
          <span className="text-sm font-medium text-gray-300 flex-shrink-0">{t("recommend.dailyTheme")}</span>
          {!isOpen && tech && (
            <span className="text-xs text-gray-300 font-semibold truncate ml-1">— {tech.name}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展開コンテンツ */}
      {isOpen && (
      <div className="mt-2 space-y-3">
      {/* 今日のおすすめテクニック */}
      {tech && (
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-semibold text-gray-400 tracking-wider">
              {t("recommend.dailyTheme")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm">{tech.name}</p>
              <p className="text-gray-400 text-xs mt-0.5">{CATEGORY_LABELS[tech.category]?.["en"] ?? tech.category}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* YouTubeクイック検索ボタン */}
              <a
                href={getYouTubeUrl(tech.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600/20 hover:bg-red-600/40 transition-colors"
                title={t("recommend.viewYoutube")}
              >
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
              <div className="text-right">
                <span className="bg-white/10 text-gray-300 text-xs px-2 py-1 rounded-full">
                  {MASTERY_LABELS[tech.mastery_level]?.["en"] ?? MASTERY_LABELS[1]?.["en"] ?? ""}
                </span>
                <p className="text-gray-500 text-xs mt-1">{t("recommend.masteryUp")}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 今日のトレーニングヒント */}
      <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-400/20">
        <div className="flex items-start gap-2">
          <span className="text-base mt-0.5">💡</span>
          <div>
            <p className="text-xs font-semibold text-yellow-400 mb-1">
              {t("recommend.trainingTip")}
            </p>
            <p className="text-gray-300 text-xs leading-relaxed">{tip.en}</p>
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}

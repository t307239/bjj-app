"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string };

const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

export default function InsightsBanner({ userId }: Props) {
  const [bestDay, setBestDay] = useState<string | null>(null);
  const [paceMsg, setPaceMsg] = useState<string | null>(null);
  const [totalStreak, setTotalStreak] = useState<number | null>(null);
  const [streakInsight, setStreakInsight] = useState<string | null>(null);
  const [consistencyMsg, setConsistencyMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const jstNow = new Date(Date.now() + 9 * 3600000);
      const toStr = (d: Date) =>
        `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

      const today = toStr(jstNow);
      const from28 = toStr(new Date(jstNow.getTime() - 28 * 86400000));
      const firstOfMonth = toStr(
        new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), 1))
      );
      const firstOfPrevMonth = toStr(
        new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() - 1, 1))
      );

      // 過去28日のログを取得（曜日分析用）+ 全ログ（ストリーク計算用）
      const [{ data: recentLogs }, { count: thisMonthCount }, { count: prevMonthCount }, { data: allLogs }] =
        await Promise.all([
          supabase
            .from("training_logs")
            .select("date")
            .eq("user_id", userId)
            .gte("date", from28)
            .lte("date", today),
          supabase
            .from("training_logs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("date", firstOfMonth)
            .lte("date", today),
          supabase
            .from("training_logs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("date", firstOfPrevMonth)
            .lt("date", firstOfMonth),
          supabase
            .from("training_logs")
            .select("date")
            .eq("user_id", userId)
            .order("date", { ascending: true }),
        ]);

      // 最多練習曜日
      if (recentLogs && recentLogs.length >= 4) {
        const dayCounts = Array(7).fill(0);
        recentLogs.forEach((l: { date: string }) => {
          const d = new Date(l.date + "T00:00:00Z");
          dayCounts[d.getUTCDay()]++;
        });
        const maxCount = Math.max(...dayCounts);
        if (maxCount >= 2) {
          const bestDayIdx = dayCounts.indexOf(maxCount);
          setBestDay(`${DAYS_JA[bestDayIdx]}曜日（${maxCount}回/4週）`);
        }
      }

      // 今月 vs 先月ペース比較
      const curDay = jstNow.getUTCDate();
      const daysInCurMonth = new Date(
        Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth() + 1, 0)
      ).getUTCDate();

      if ((thisMonthCount ?? 0) > 0 && curDay > 0) {
        const projected = Math.round(
          (thisMonthCount ?? 0) / curDay * daysInCurMonth
        );
        if ((prevMonthCount ?? 0) > 0) {
          const diff = projected - (prevMonthCount ?? 0);
          if (diff > 0) {
            setPaceMsg(`先月比 +${diff}回ペース 📈`);
          } else if (diff < 0) {
            setPaceMsg(`先月比 ${diff}回ペース`);
          } else {
            setPaceMsg("先月と同じペース ➡️");
          }
        } else {
          // 先月データなし（1ヶ月目）
          setPaceMsg(`今月 ${thisMonthCount}回記録中 ✨`);
        }
        setTotalStreak(thisMonthCount ?? 0);
      }

      // 最長連続日数
      if (allLogs && allLogs.length >= 3) {
        const uniqueDates = [...new Set(allLogs.map((l: { date: string }) => l.date))].sort();
        let maxStreak = uniqueDates.length > 0 ? 1 : 0;
        let curStreak = 1;
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1] as string);
          const curr = new Date(uniqueDates[i] as string);
          const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
          if (diff === 1) {
            curStreak++;
            if (curStreak > maxStreak) maxStreak = curStreak;
          } else {
            curStreak = 1;
          }
        }
        if (maxStreak >= 3) {
          setStreakInsight(`最長連続: ${maxStreak}日`);
        }
      }

      // 過去28日の練習率（練習した日 / 28日）
      if (recentLogs && recentLogs.length >= 4) {
        const uniqueTrainedDays = new Set(recentLogs.map((l: { date: string }) => l.date)).size;
        const rate = Math.round((uniqueTrainedDays / 28) * 100);
        if (rate >= 30) {
          const emoji = rate >= 70 ? "🏆" : rate >= 50 ? "💪" : "📅";
          setConsistencyMsg(`${emoji} 練習率${rate}%`);
        }
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Wiki トピック推薦（継続率に応じた学習誘導）
  const wikiTip = consistencyMsg
    ? {
        href: "https://bjj-wiki.com/ja/bjj-conceptual-learning-framework.html",
        label: "BJJコンセプト学習法を読む →",
      }
    : streakInsight
    ? {
        href: "https://bjj-wiki.com/ja/bjj-flow-state-training.html",
        label: "フロー状態トレーニングを読む →",
      }
    : paceMsg?.includes("📈")
    ? {
        href: "https://bjj-wiki.com/ja/bjj-drilling-methodology.html",
        label: "ドリリング方法論を読む →",
      }
    : null;

  if (!bestDay && !paceMsg && !streakInsight && !consistencyMsg) return null;

  return (
    <div className="bg-[#0f3460]/40 border border-[#e94560]/20 rounded-xl px-4 py-3 mb-4">
      <p className="text-[11px] font-semibold text-[#e94560] mb-2 uppercase tracking-wide">
        📊 練習インサイト
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {paceMsg && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">ペース</span>
            <span className="text-xs text-gray-200 font-medium">{paceMsg}</span>
          </div>
        )}
        {bestDay && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">よく練習する日</span>
            <span className="text-xs text-gray-200 font-medium">{bestDay}</span>
          </div>
        )}
        {totalStreak !== null && totalStreak >= 10 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">今月</span>
            <span className="text-xs text-green-400 font-medium">{totalStreak}回達成 🎯</span>
          </div>
        )}
        {streakInsight && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">記録</span>
            <span className="text-xs text-yellow-400 font-medium">🔥 {streakInsight}</span>
          </div>
        )}
        {consistencyMsg && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">継続率</span>
            <span className="text-xs text-blue-300 font-medium">{consistencyMsg}</span>
          </div>
        )}
      </div>
      {wikiTip && (
        <div className="mt-2 pt-2 border-t border-[#e94560]/10">
          <a
            href={wikiTip.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#e94560]/70 hover:text-[#e94560] transition-colors"
          >
            📚 {wikiTip.label}
          </a>
        </div>
      )}
    </div>
  );
}

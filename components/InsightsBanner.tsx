"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString, getLocalDateParts, getMonthStartDate } from "@/lib/timezone";

type Props = { userId: string };

const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function InsightsBanner({ userId }: Props) {
  const { t } = useLocale();
  const [bestDay, setBestDay] = useState<string | null>(null);
  const [paceMsg, setPaceMsg] = useState<string | null>(null);
  const [totalStreak, setTotalStreak] = useState<number | null>(null);
  const [streakInsight, setStreakInsight] = useState<string | null>(null);
  const [consistencyMsg, setConsistencyMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      // Use user's local timezone via Intl API (replaces JST hardcode)
      const today = getLocalDateString();
      const { year, month, day } = getLocalDateParts();
      const from28Date = new Date(Date.UTC(year, month - 1, day - 28));
      const from28 = `${from28Date.getUTCFullYear()}-${String(from28Date.getUTCMonth() + 1).padStart(2, "0")}-${String(from28Date.getUTCDate()).padStart(2, "0")}`;
      const firstOfMonth = getMonthStartDate();
      const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
      const firstOfPrevMonth = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;

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
          // Cap at 365 days: longest streaks almost never span > 1 year
          // and this keeps the payload small for veteran users
          supabase
            .from("training_logs")
            .select("date")
            .eq("user_id", userId)
            .gte("date", new Date(Date.now() - 365 * 86400000).toISOString().split("T")[0])
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
          setBestDay(`${DAYS_EN[bestDayIdx]} (${maxCount}× / 4 wks)`);
        }
      }

      // Month-over-month pace comparison
      const curDay = day;
      const daysInCurMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

      if ((thisMonthCount ?? 0) > 0 && curDay > 0) {
        const projected = Math.round(
          (thisMonthCount ?? 0) / curDay * daysInCurMonth
        );
        if ((prevMonthCount ?? 0) > 0) {
          const diff = projected - (prevMonthCount ?? 0);
          if (diff > 0) {
            setPaceMsg(t("insights.lastMonthComparePlus", { n: diff }));
          } else if (diff < 0) {
            setPaceMsg(t("insights.lastMonthCompareMinus", { n: diff }));
          } else {
            setPaceMsg(t("insights.lastMonthCompareSame"));
          }
        } else {
          // 先月データなし（1ヶ月目）
          setPaceMsg(t("insights.thisMonthRecording", { n: thisMonthCount ?? 0 }));
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
          setStreakInsight(t("insights.longestStreak", { n: maxStreak }));
        }
      }

      // 過去28日の練習率（練習した日 / 28日）
      if (recentLogs && recentLogs.length >= 4) {
        const uniqueTrainedDays = new Set(recentLogs.map((l: { date: string }) => l.date)).size;
        const rate = Math.round((uniqueTrainedDays / 28) * 100);
        if (rate >= 30) {
          const emoji = rate >= 70 ? "🏆" : rate >= 50 ? "💪" : "📅";
          setConsistencyMsg(t("insights.consistencyRate", { emoji, rate }));
        }
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Wiki topic recommendation based on consistency data
  const wikiTip = consistencyMsg
    ? {
        href: "https://wiki.bjj-app.net/en/bjj-conceptual-learning-framework.html",
        label: "Read: BJJ Conceptual Learning",
      }
    : streakInsight
    ? {
        href: "https://wiki.bjj-app.net/en/bjj-flow-state-training.html",
        label: "Read: Flow State Training",
      }
    : paceMsg?.includes("📈")
    ? {
        href: "https://wiki.bjj-app.net/en/bjj-drilling-methodology.html",
        label: "Read: Drilling Methodology",
      }
    : null;

  if (!bestDay && !paceMsg && !streakInsight && !consistencyMsg) return null;

  return (
    <div className="bg-zinc-900/50 backdrop-blur-sm border border-[#e94560]/20 rounded-2xl px-4 py-3 mb-4 shadow-lg shadow-black/40">
      <p className="text-[11px] font-semibold text-[#e94560] mb-2 uppercase tracking-wide">
        📊 {t("insights.title")}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {paceMsg && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">{t("insights.pace")}</span>
            <span className="text-xs text-zinc-100 font-medium">{paceMsg}</span>
          </div>
        )}
        {bestDay && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">{t("insights.bestDayOfWeek")}</span>
            <span className="text-xs text-zinc-100 font-medium">{bestDay}</span>
          </div>
        )}
        {totalStreak !== null && totalStreak >= 10 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">{t("insights.thisMonth")}</span>
            <span className="text-xs text-green-400 font-medium">{totalStreak}回{t("insights.achieved")} 🎯</span>
          </div>
        )}
        {streakInsight && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">{t("insights.record")}</span>
            <span className="text-xs text-yellow-400 font-medium">🔥 {streakInsight}</span>
          </div>
        )}
        {consistencyMsg && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500">{t("insights.consistency")}</span>
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
            className="inline-flex items-center gap-1 text-[11px] text-[#e94560]/70 hover:text-[#e94560] transition-colors"
          >
            📚 {wikiTip.label}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

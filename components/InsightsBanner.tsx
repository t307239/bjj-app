"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { userId: string };

const DAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

export default function InsightsBanner({ userId }: Props) {
  const [bestDay, setBestDay] = useState<string | null>(null);
  const [paceMsg, setPaceMsg] = useState<string | null>(null);
  const [totalStreak, setTotalStreak] = useState<number | null>(null);

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

      // 過去28日のログを取得（曜日分析用）
      const [{ data: recentLogs }, { count: thisMonthCount }, { count: prevMonthCount }] =
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

      // 今月 vs 先月ペース㯔較
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
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!bestDay && !paceMsg) return null;

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
      </div>
    </div>
  );
}

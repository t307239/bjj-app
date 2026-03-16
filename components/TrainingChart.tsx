"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type DayData = {
  date: string;
  count: number;
};

type Props = {
  userId: string;
};

// 過去84日（12週）のヒートマップ
export default function TrainingChart({ userId }: Props) {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const since = new Date();
      since.setDate(since.getDate() - 83);
      const sinceStr = since.toISOString().split("T")[0];

      const { data: logs } = await supabase
        .from("training_logs")
        .select("date")
        .eq("user_id", userId)
        .gte("date", sinceStr);

      if (logs) {
        // 日付ごとのカウント集計
        const counts: Record<string, number> = {};
        logs.forEach((l: { date: string }) => {
          counts[l.date] = (counts[l.date] || 0) + 1;
        });

        // 過去84日分の配列を作成
        const days: DayData[] = [];
        for (let i = 83; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split("T")[0];
          days.push({ date: dateStr, count: counts[dateStr] || 0 });
        }
        setData(days);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return null;
  if (data.every((d) => d.count === 0)) return null;

  const getColor = (count: number) => {
    if (count === 0) return "bg-gray-800";
    if (count === 1) return "bg-[#e94560]/40";
    if (count === 2) return "bg-[#e94560]/70";
    return "bg-[#e94560]";
  };

  // 12週分（7日×12列）
  const weeks: DayData[][] = [];
  for (let i = 0; i < 12; i++) {
    weeks.push(data.slice(i * 7, i * 7 + 7));
  }

  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const totalDays = data.filter((d) => d.count > 0).length;

  return (
    <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">練習アクティビティ</h4>
        <span className="text-xs text-gray-500">過去84日: {totalDays}日練習</span>
      </div>
      <div className="flex gap-1">
        {/* 曜日ラベル */}
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((d) => (
            <div key={d} className="text-[9px] text-gray-600 h-3 flex items-center">
              {d}
            </div>
          ))}
        </div>
        {/* ヒートマップグリッド */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((day, di) => (
              <div
                key={di}
                className={`w-3 h-3 rounded-sm ${getColor(day.count)} transition-colors`}
                title={`${day.date}: ${day.count}回`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-600">
        <span>少</span>
        <div className="w-3 h-3 rounded-sm bg-gray-800" />
        <div className="w-3 h-3 rounded-sm bg-[#e94560]/40" />
        <div className="w-3 h-3 rounded-sm bg-[#e94560]/70" />
        <div className="w-3 h-3 rounded-sm bg-[#e94560]" />
        <span>多</span>
      </div>
    </div>
  );
}

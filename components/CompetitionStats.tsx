"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import Skeleton from "@/components/ui/Skeleton";

type Props = {
  userId: string;
};

type CompRecord = {
  win: number;
  loss: number;
  draw: number;
  total: number;
  winBySub: number;   // 一本勝ち（finishあり）
  lossBySub: number;  // 一本負け（finishあり）
  currentWinStreak: number;  // 現在の連勝数
  bestWinStreak: number;     // 最長連勝記録
  gi_count: number;          // 道衣試合数
  nogi_count: number;        // ノーギ試合数
};

type CompEntry = { result: string; finish: string; gi_type: string; opponent_rank: string };

type MonthStats = {
  ym: string;    // "2026-03"
  label: string; // "3月"
  win: number;
  loss: number;
  draw: number;
  total: number;
};

// 試合ノートのデコード（TrainingLogと同じロジック）
const COMP_PREFIX = "__comp__";

function decodeEntry(notes: string): CompEntry | null {
  if (!notes || !notes.startsWith(COMP_PREFIX)) return null;
  const nl = notes.indexOf("\n");
  const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
  try {
    const comp = JSON.parse(jsonStr) as { result: string; finish?: string; gi_type?: string; opponent_rank?: string };
    return { result: comp.result, finish: comp.finish ?? "", gi_type: comp.gi_type ?? "gi", opponent_rank: comp.opponent_rank ?? "" };
  } catch {
    return null;
  }
}

// SVGドーナツチャートのセグメント
function DonutSegment({
  value,
  total,
  offset,
  color,
  r,
}: {
  value: number;
  total: number;
  offset: number;
  color: string;
  r: number;
}) {
  if (value === 0 || total === 0) return null;
  const cx = 40;
  const cy = 40;
  const circumference = 2 * Math.PI * r;
  const pct = value / total;
  const dash = pct * circumference;
  const gap = circumference - dash;
  const rotate = (offset / total) * 360 - 90;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={14}
      strokeDasharray={`${dash} ${gap}`}
      transform={`rotate(${rotate} ${cx} ${cy})`}
      strokeLinecap="butt"
    />
  );
}

export default function CompetitionStats({ userId }: Props) {
  const { t } = useLocale();
  const [record, setRecord] = useState<CompRecord | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<MonthStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("training_logs")
        .select("notes, date")
        .eq("user_id", userId)
        .eq("type", "competition")
        .order("date", { ascending: true });

      if (data) {
        const rec: CompRecord = { win: 0, loss: 0, draw: 0, total: 0, winBySub: 0, lossBySub: 0, currentWinStreak: 0, bestWinStreak: 0, gi_count: 0, nogi_count: 0 };
        // Build ordered results for streak calculation
        const results: string[] = [];
        data.forEach((l: { notes: string; date: string }) => {
          const entry = decodeEntry(l.notes);
          if (!entry) { rec.total++; results.push("unknown"); return; }
          const hasSub = entry.finish.trim() !== "";
          // Gi/NoGi集計
          if (entry.gi_type === "nogi") rec.nogi_count++;
          else rec.gi_count++;
          if (entry.result === "win") {
            rec.win++;
            rec.total++;
            if (hasSub) rec.winBySub++;
            results.push("win");
          } else if (entry.result === "loss") {
            rec.loss++;
            rec.total++;
            if (hasSub) rec.lossBySub++;
            results.push("loss");
          } else if (entry.result === "draw") {
            rec.draw++;
            rec.total++;
            results.push("draw");
          } else {
            rec.total++;
            results.push("unknown");
          }
        });
        // Calculate win streaks (iterate oldest→newest)
        let streak = 0;
        let best = 0;
        for (const r of results) {
          if (r === "win") {
            streak++;
            if (streak > best) best = streak;
          } else if (r === "loss") {
            streak = 0;
          }
          // draw/unknown doesn't break streak
        }
        rec.currentWinStreak = streak;
        rec.bestWinStreak = best;
        setRecord(rec);

        // 月別集計
        const monthMap: Record<string, MonthStats> = {};
        data.forEach((l: { notes: string; date: string }) => {
          const ym = l.date.slice(0, 7);
          if (!monthMap[ym]) {
            const [y2, m2] = ym.split("-");
            const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(parseInt(y2), parseInt(m2) - 1, 1));
            monthMap[ym] = { ym, label: monthLabel, win: 0, loss: 0, draw: 0, total: 0 };
          }
          monthMap[ym].total++;
          const entry = decodeEntry(l.notes);
          if (!entry) return;
          if (entry.result === "win") monthMap[ym].win++;
          else if (entry.result === "loss") monthMap[ym].loss++;
          else if (entry.result === "draw") monthMap[ym].draw++;
        });
        const months = Object.values(monthMap).sort((a, b) => a.ym.localeCompare(b.ym));
        setMonthlyStats(months);
      }
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return <Skeleton height={100} rounded="xl" className="mb-4" />;

  if (!record || record.total === 0) {
    return (
      <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <h4 className="text-sm font-medium text-gray-300">🏆 {t("competition.title")}</h4>
        </div>
        <div className="p-6 text-center">
          <div className="text-3xl mb-2">🥋</div>
          <p className="text-gray-400 text-sm">{t("competition.noCompetitions")}</p>
          <p className="text-gray-500 text-xs mt-1">{t("competition.noCompetitionsHint")}</p>
        </div>
      </div>
    );
  }

  const decoded = record.win + record.loss + record.draw;
  const winPct = decoded > 0 ? Math.round((record.win / decoded) * 100) : 0;
  const winByDecision = record.win - record.winBySub;
  const lossToSub = record.lossBySub;
  const showBreakdown = record.win > 0 && (record.winBySub > 0 || winByDecision > 0);

  // ドーナツチャート用
  const donutR = 28;

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 mb-4 overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <h4 className="text-sm font-medium text-gray-300">🏆 {t("competition.title")}</h4>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-xs text-gray-500">
              {record.win}W {record.loss}L{record.draw > 0 ? ` ${record.draw}D` : ""} · {record.total}{t("competition.matchesSuffix")}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {isOpen && (<div className="p-4 border-t border-white/10">

      {/* ドーナツチャート + W/L/D 暪並び */}
      <div className="flex items-center gap-4 mb-3">
        {/* SVG ドーナツチャート */}
        {decoded > 0 && (
          <div className="relative flex-shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80">
              {/* 背景トラック */}
              <circle
                cx="40" cy="40" r={donutR}
                fill="none"
                stroke="#374151"
                strokeWidth={14}
              />
              {/* 勝利セグメント（緑） */}
              <DonutSegment
                value={record.win}
                total={decoded}
                offset={0}
                color="#4ade80"
                r={donutR}
              />
              {/* 敗北セグメント（赤） */}
              <DonutSegment
                value={record.loss}
                total={decoded}
                offset={record.win}
                color="#f87171"
                r={donutR}
              />
              {/* 引き分けセグメント（黄） */}
              <DonutSegment
                value={record.draw}
                total={decoded}
                offset={record.win + record.loss}
                color="#fbbf24"
                r={donutR}
              />
              {/* 中央テキスト */}
              <text x="40" y="36" textAnchor="middle" className="fill-white" style={{ fill: "white", fontSize: "14px", fontWeight: "bold" }}>
                {winPct}%
              </text>
              <text x="40" y="50" textAnchor="middle" style={{ fill: "#71717a", fontSize: "9px" }}>
                {t("competition.winRate")}
              </text>
            </svg>
          </div>
        )}

        {/* W/L/D グリッド */}
        <div className="flex-1 grid grid-cols-3 gap-1.5">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2 text-center">
            <div className="text-xl font-bold text-green-400">{record.win}</div>
            <div className="text-xs text-gray-500">{t("competition.wins")}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2 text-center">
            <div className="text-xl font-bold text-red-400">{record.loss}</div>
            <div className="text-xs text-gray-500">{t("competition.losses")}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 text-center">
            <div className="text-xl font-bold text-yellow-400">{record.draw}</div>
            <div className="text-xs text-gray-500">{t("competition.draws")}</div>
          </div>
        </div>
      </div>

      {/* 勝利内訳 */}
      {showBreakdown && (
        <div className="flex gap-2 mb-3">
          {record.winBySub > 0 && (
            <span className="text-xs bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-full">
              {t("competition.bySubmission")} {record.winBySub}
            </span>
          )}
          {winByDecision > 0 && (
            <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
              {t("competition.byDecision")} {winByDecision}
            </span>
          )}
          {lossToSub > 0 && (
            <span className="text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-1 rounded-full">
              {t("competition.lossBySubmission")} {lossToSub}
            </span>
          )}
        </div>
      )}

      {/* Gi / NoGi内訳 */}
      {(record.gi_count > 0 || record.nogi_count > 0) && (
        <div className="flex gap-2 mb-3">
          {record.gi_count > 0 && (
            <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
              {t("training.gi")} {record.gi_count}{t("competition.matchesSuffix")}
            </span>
          )}
          {record.nogi_count > 0 && (
            <span className="text-xs bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
              {t("training.nogi")} {record.nogi_count}{t("competition.matchesSuffix")}
            </span>
          )}
        </div>
      )}

      {/* 連勝記録 */}
      {(record.currentWinStreak > 0 || record.bestWinStreak > 1) && (
        <div className="flex gap-2 mb-3">
          {record.currentWinStreak > 0 && (
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-1.5">
              <span className="text-green-400 text-xs font-medium">🔥 {t("competition.currentStreak", { n: record.currentWinStreak })}</span>
            </div>
          )}
          {record.bestWinStreak > 1 && (
            <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5">
              <span className="text-yellow-400 text-xs font-medium">⭐ {t("competition.bestStreak", { n: record.bestWinStreak })}</span>
            </div>
          )}
        </div>
      )}

      {/* 勝率バー */}
      {decoded > 0 && (
        <div>
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-400 transition-all duration-500"
              style={{ width: `${winPct}%` }}
            />
            {record.draw > 0 && (
              <div
                className="h-full bg-yellow-400 transition-all duration-500"
                style={{ width: `${decoded > 0 ? Math.round((record.draw / decoded) * 100) : 0}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* 月別勝敗バー（3試合以上 かつ 2ヶ月以上ある場合） */}
      {record.total >= 3 && monthlyStats.length >= 2 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs text-gray-500 mb-2 tracking-wide">{t("competition.monthly")}</p>
          {(() => {
            const maxTotal = Math.max(...monthlyStats.map((m) => m.total), 1);
            return monthlyStats.slice(-6).map((m) => (
              <div key={m.ym} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-gray-500 w-8 flex-shrink-0 text-right">{m.label}</span>
                <div className="flex-1 h-4 bg-zinc-900/50 rounded-lg overflow-hidden flex">
                  {m.win > 0 && (
                    <div
                      className="h-full bg-green-500/80"
                      style={{ width: `${(m.win / maxTotal) * 100}%` }}
                    />
                  )}
                  {m.draw > 0 && (
                    <div
                      className="h-full bg-yellow-500/80"
                      style={{ width: `${(m.draw / maxTotal) * 100}%` }}
                    />
                  )}
                  {m.loss > 0 && (
                    <div
                      className="h-full bg-red-500/80"
                      style={{ width: `${(m.loss / maxTotal) * 100}%` }}
                    />
                  )}
                </div>
                <span className="text-xs text-gray-400 w-16 flex-shrink-0">
                  {m.win}W{m.loss > 0 ? ` ${m.loss}L` : ""}{m.draw > 0 ? ` ${m.draw}D` : ""}
                </span>
              </div>
            ));
          })()}
        </div>
      )}
      </div>)}
    </div>
  );
}

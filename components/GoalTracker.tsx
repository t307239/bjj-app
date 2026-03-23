"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";
import { useLocale } from "@/lib/i18n";
import { getLocalDateParts, getWeekStartDate, getMonthStartDate } from "@/lib/timezone";

type Props = {
  userId: string;
};

type GoalData = {
  weeklyGoal: number;
  monthlyGoal: number;
  techniqueGoal: number;
  weekCount: number;
  monthCount: number;
  techniqueCount: number;
};

type MonthHistory = {
  ym: string;      // "2026-03"
  label: string;   // "Mar"
  count: number;
  achieved: boolean;
};

type WeekHistory = {
  weekStart: string; // "2026-03-10"
  label: string;     // "This week" / "Last week" / "2 weeks ago" / "3 weeks ago"
  count: number;
  achieved: boolean;
  isCurrent: boolean;
};

function ProgressBar({ current, target, sessionsUnit, doneLabel }: { current: number; target: number; sessionsUnit: string; doneLabel: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const done = current >= target && target > 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-bold ${done ? "text-green-400" : "text-[#e94560]"}`}>
          {current}{sessionsUnit} / {target}{sessionsUnit}
        </span>
        <span className={`text-[11px] ${done ? "text-green-400" : "text-gray-500"}`}>
          {done ? `✓ ${doneLabel}` : `${pct}%`}
        </span>
      </div>
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: done
              ? "#4ade80"
              : "linear-gradient(to right, #e94560 0%, #f97316 35%, #eab308 65%, #4ade80 100%)",
          }}
        />
      </div>
    </div>
  );
}

function GoalEditor({
  header,
  currentDoneText,
  sessionsLabel,
  cancelLabel,
  setLabel,
  current,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  header: string;
  currentDoneText: string;
  sessionsLabel: string;
  cancelLabel: string;
  setLabel: string;
  current: number;
  value: number;
  onChange: (v: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-[#e94560]/30">
      <div className="text-xs text-gray-400 mb-3">{header}</div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 rounded-lg bg-white/10 text-white text-lg font-bold hover:bg-white/15 transition-colors"
        >
          -
        </button>
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold text-white">{value}</span>
          <span className="text-gray-400 text-sm ml-1">{sessionsLabel}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(30, value + 1))}
          className="w-9 h-9 rounded-lg bg-white/10 text-white text-lg font-bold hover:bg-white/15 transition-colors"
        >
          +
        </button>
      </div>
      {value > 0 && (
        <div className="text-xs text-gray-500 text-center mb-3">
          {currentDoneText}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-white/10 text-gray-300 text-sm hover:bg-white/15 transition-colors"
        >
          {cancelLabel}
        </button>
        <button
          onClick={onSave}
          disabled={value === 0}
          className="flex-1 py-2 rounded-lg bg-[#e94560] text-white text-sm font-semibold hover:bg-[#c73652] disabled:opacity-40 transition-colors"
        >
          {setLabel}
        </button>
      </div>
    </div>
  );
}

export default function GoalTracker({ userId }: Props) {
  const { t } = useLocale();
  const [data, setData] = useState<GoalData>({
    weeklyGoal: 0,
    monthlyGoal: 0,
    techniqueGoal: 0,
    weekCount: 0,
    monthCount: 0,
    techniqueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [schemaReady, setSchemaReady] = useState(true);
  const [editing, setEditing] = useState<"weekly" | "monthly" | "technique" | null>(null);
  const [editValue, setEditValue] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [monthHistory, setMonthHistory] = useState<MonthHistory[]>([]);
  const [weekHistory, setWeekHistory] = useState<WeekHistory[]>([]);
  const [currentWeekDayGrid, setCurrentWeekDayGrid] = useState<boolean[]>(Array(7).fill(false));
  const [isOpen, setIsOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // Use user's local timezone via Intl API (replaces JST hardcode)
      const firstDayOfMonth = getMonthStartDate();
      const firstDayOfWeek = getWeekStartDate();

      const [{ count: mc }, { count: wc }, { count: tc }, profileRes] = await Promise.all([
        supabase
          .from("training_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("date", firstDayOfMonth),
        supabase
          .from("training_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("date", firstDayOfWeek),
        supabase
          .from("techniques")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("profiles")
          .select("weekly_goal, monthly_goal, technique_goal")
          .eq("id", userId)
          .single(),
      ]);

      // スキーマ未対応チェック（カラム非存在）
      if (profileRes.error && profileRes.error.code === "42703") {
        setSchemaReady(false);
        setLoading(false);
        return;
      }

      const mGoal = profileRes.data?.monthly_goal ?? 0;

      setData({
        weeklyGoal: profileRes.data?.weekly_goal ?? 0,
        monthlyGoal: mGoal,
        techniqueGoal: (profileRes.data as { technique_goal?: number } | null)?.technique_goal ?? 0,
        weekCount: wc ?? 0,
        monthCount: mc ?? 0,
        techniqueCount: tc ?? 0,
      });

      const wGoal = profileRes.data?.weekly_goal ?? 0;

      // 過去4週の週間達成履歴
      if (wGoal > 0) {
        const thisWeekStart = getWeekStartDate();
        const tw = new Date(thisWeekStart + "T00:00:00Z");
        const thisWeekMonMs = tw.getTime();
        const fourWeeksAgoMs = thisWeekMonMs - 3 * 7 * 86400000;
        const fw = new Date(fourWeeksAgoMs);
        const fourWeeksAgoStr = `${fw.getUTCFullYear()}-${String(fw.getUTCMonth() + 1).padStart(2, "0")}-${String(fw.getUTCDate()).padStart(2, "0")}`;

        const { data: wLogs } = await supabase
          .from("training_logs")
          .select("date")
          .eq("user_id", userId)
          .gte("date", fourWeeksAgoStr);

        // 今週の曜日別達成グリッド（月=0...日=6）
        const dayGrid: boolean[] = Array(7).fill(false);
        (wLogs ?? []).forEach((l) => {
          if (l.date >= thisWeekStart) {
            const d = new Date(l.date + "T00:00:00Z");
            const dow = d.getUTCDay(); // 0=Sun
            const idx = dow === 0 ? 6 : dow - 1; // Mon=0...Sun=6
            dayGrid[idx] = true;
          }
        });
        setCurrentWeekDayGrid(dayGrid);

        const wh: WeekHistory[] = [];
        for (let i = 3; i >= 0; i--) {
          const wStartMs = thisWeekMonMs - i * 7 * 86400000;
          const wEndMs = wStartMs + 6 * 86400000;
          const ws = new Date(wStartMs);
          const we = new Date(wEndMs);
          const wsStr = `${ws.getUTCFullYear()}-${String(ws.getUTCMonth() + 1).padStart(2, "0")}-${String(ws.getUTCDate()).padStart(2, "0")}`;
          const weStr = `${we.getUTCFullYear()}-${String(we.getUTCMonth() + 1).padStart(2, "0")}-${String(we.getUTCDate()).padStart(2, "0")}`;
          const cnt = (wLogs ?? []).filter((l) => l.date >= wsStr && l.date <= weStr).length;
          wh.push({
            weekStart: wsStr,
            label: i === 0 ? "This week" : i === 1 ? "Last week" : i === 2 ? "2 weeks ago" : "3 weeks ago",
            count: cnt,
            achieved: cnt >= wGoal,
            isCurrent: i === 0,
          });
        }
        setWeekHistory(wh);
      }

      // 過去6ヶ月の達成履歴を計算
      if (mGoal > 0) {
        const { year: nowYear, month: nowMonth } = getLocalDateParts();
        const history: MonthHistory[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(Date.UTC(nowYear, nowMonth - 1 - i, 1));
          const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          const nextD = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
          const nextYm = `${nextD.getUTCFullYear()}-${String(nextD.getUTCMonth() + 1).padStart(2, "0")}-01`;
          const { count: hc } = await supabase
            .from("training_logs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("date", `${ym}-01`)
            .lt("date", nextYm);
          history.push({
            ym,
            label: `${d.getUTCMonth() + 1}`,
            count: hc ?? 0,
            achieved: (hc ?? 0) >= mGoal,
          });
        }
        setMonthHistory(history);
      }

      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startEdit = (type: "weekly" | "monthly" | "technique") => {
    setEditValue(
      type === "weekly" ? data.weeklyGoal
      : type === "monthly" ? data.monthlyGoal
      : data.techniqueGoal
    );
    setEditing(type);
  };

  const saveGoal = async () => {
    if (!editing) return;
    const col = editing === "weekly" ? "weekly_goal"
      : editing === "monthly" ? "monthly_goal"
      : "technique_goal";
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, [col]: editValue }, { onConflict: "id" });

    if (!error) {
      setData((prev) => ({
        ...prev,
        weeklyGoal: editing === "weekly" ? editValue : prev.weeklyGoal,
        monthlyGoal: editing === "monthly" ? editValue : prev.monthlyGoal,
        techniqueGoal: editing === "technique" ? editValue : prev.techniqueGoal,
      }));
      setToast({ message: t("goal.goalSaved"), type: "success" });
    } else {
      setToast({ message: t("goal.goalFailed"), type: "error" });
    }
    setEditing(null);
  };

  if (loading) return null;

  if (!schemaReady) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 mb-4 shadow-lg shadow-black/40">
        <p className="text-xs text-gray-500 text-center">
          To enable goal tracking, run
          <code className="text-yellow-400 mx-1">supabase-goals-schema.sql</code>
          in Supabase.
        </p>
      </div>
    );
  }

  const hasGoals = data.weeklyGoal > 0 || data.monthlyGoal > 0 || data.techniqueGoal > 0;

  // 今月の残り日数・ペース計算
  const { day: curDayOfMonth, daysInMonth: daysInCurMonth } = getLocalDateParts();
  const remainingDaysInMonth = daysInCurMonth - curDayOfMonth;
  // 今月のペース予測（月末まで同じペースで続けた場合の回数）
  const monthlyProjected =
    curDayOfMonth > 0 && data.monthCount > 0
      ? Math.round((data.monthCount / curDayOfMonth) * daysInCurMonth)
      : 0;
  const monthOnTrack = monthlyProjected >= data.monthlyGoal;

  // 全目標達成バナー
  const activeGoalStates = [
    { target: data.weeklyGoal, current: data.weekCount },
    { target: data.monthlyGoal, current: data.monthCount },
    { target: data.techniqueGoal, current: data.techniqueCount },
  ].filter((g) => g.target > 0);
  const allGoalsAchieved = hasGoals && activeGoalStates.length > 0 && activeGoalStates.every((g) => g.current >= g.target);

  // 連続達成月数（直近から遡って連続している月数）
  const consecutiveAchievedMonths = (() => {
    if (monthHistory.length === 0) return 0;
    let cnt = 0;
    for (let i = monthHistory.length - 1; i >= 0; i--) {
      if (monthHistory[i].achieved) cnt++;
      else break;
    }
    return cnt;
  })();

  // 連続達成週数（直近から遡って連続している週数）
  const consecutiveAchievedWeeks = (() => {
    if (weekHistory.length === 0) return 0;
    let cnt = 0;
    for (let i = weekHistory.length - 1; i >= 0; i--) {
      if (weekHistory[i].achieved) cnt++;
      else break;
    }
    return cnt;
  })();

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-white/10 mb-4 overflow-hidden shadow-lg shadow-black/40">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors text-left"
        >
          <h4 className="text-sm font-medium text-gray-300">{t("goal.title")}</h4>
          <div className="flex items-center gap-2">
            {!isOpen && hasGoals && (
              <span className="text-[10px] text-gray-500">
                {[
                  data.weeklyGoal > 0 ? t("goal.compactWeekly", { a: data.weekCount, b: data.weeklyGoal }) : "",
                  data.monthlyGoal > 0 ? t("goal.compactMonthly", { a: data.monthCount, b: data.monthlyGoal }) : "",
                ].filter(Boolean).join(" · ")}
              </span>
            )}
            {!isOpen && !hasGoals && (
              <span className="text-[10px] text-gray-600">{t("goal.setAGoal")}</span>
            )}
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {isOpen && (<>

        {/* 全目標達成バナー（Confetti風アニメーション） */}
        {allGoalsAchieved && !editing && (
          <div className="mx-4 mt-3 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-center relative overflow-hidden">
            <style>{`
              @keyframes cf-fall {
                0%   { transform: translateY(-8px) rotate(0deg);   opacity: 1; }
                100% { transform: translateY(68px) rotate(600deg); opacity: 0; }
              }
              .cf-p { position:absolute; width:6px; height:6px; border-radius:1px; animation: cf-fall linear infinite; top:0; }
              .cf-p:nth-child(1){left:6%;  background:#e94560; animation-duration:1.3s; animation-delay:0s;}
              .cf-p:nth-child(2){left:17%; background:#4ade80; animation-duration:1.5s; animation-delay:.15s;}
              .cf-p:nth-child(3){left:29%; background:#facc15; animation-duration:1.2s; animation-delay:.05s;}
              .cf-p:nth-child(4){left:41%; background:#60a5fa; animation-duration:1.6s; animation-delay:.3s;}
              .cf-p:nth-child(5){left:54%; background:#e94560; animation-duration:1.4s; animation-delay:.1s;}
              .cf-p:nth-child(6){left:66%; background:#a78bfa; animation-duration:1.3s; animation-delay:.25s;}
              .cf-p:nth-child(7){left:78%; background:#4ade80; animation-duration:1.5s; animation-delay:.4s;}
              .cf-p:nth-child(8){left:90%; background:#facc15; animation-duration:1.2s; animation-delay:.2s;}
            `}</style>
            <div className="cf-p"/><div className="cf-p"/><div className="cf-p"/><div className="cf-p"/>
            <div className="cf-p"/><div className="cf-p"/><div className="cf-p"/><div className="cf-p"/>
            <div className="text-2xl mb-1 animate-bounce">🎉</div>
            <div className="text-sm font-bold text-green-400">{t("goal.allAchieved")}</div>
            <div className="text-[11px] text-gray-400 mt-1">
              {consecutiveAchievedMonths >= 3
                ? t("goal.monthsInRow", { n: consecutiveAchievedMonths })
                : consecutiveAchievedMonths >= 2
                ? t("goal.monthsHabit", { n: consecutiveAchievedMonths })
                : t("goal.keepGoing")}
            </div>
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Weekly Goal */}
          {editing === "weekly" ? (
            <GoalEditor
              header={t("goal.setWeeklyHeader")}
              currentDoneText={t("goal.currentDone", { n: data.weekCount })}
              sessionsLabel={t("goal.sessionsPicker")}
              cancelLabel={t("goal.cancel")}
              setLabel={t("goal.set")}
              current={data.weekCount}
              value={editValue}
              onChange={setEditValue}
              onSave={saveGoal}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => startEdit("weekly")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{t("goal.weekly")}</span>
                  {data.weekCount >= data.weeklyGoal && data.weeklyGoal > 0 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{t("goal.done")}</span>
                  )}
                </div>
                <button className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  {data.weeklyGoal > 0 ? t("goal.edit") : t("goal.plusSet")}
                </button>
              </div>
              {data.weeklyGoal > 0 ? (
                <>
                  <ProgressBar current={data.weekCount} target={data.weeklyGoal} sessionsUnit={t("chart.timesUnit")} doneLabel={t("goal.done")} />
                  {/* Day-by-day achievement grid */}
                  {(() => {
                    // Mon=0…Sun=6, locale-aware short weekday (2024-01-01 is Monday)
                    const DAY_LABELS = Array.from({ length: 7 }, (_, i) =>
                      new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(2024, 0, 1 + i))
                    );
                    const dowNow = getLocalDateParts().dayOfWeek; // 0=Sun
                    const todayIdx = dowNow === 0 ? 6 : dowNow - 1; // Mon=0...Sun=6
                    return (
                      <div className="mt-2 flex items-center gap-1">
                        {DAY_LABELS.map((label, i) => {
                          const isPast = i < todayIdx;
                          const isToday = i === todayIdx;
                          const isFuture = i > todayIdx;
                          const trained = currentWeekDayGrid[i];
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                              <div
                                className={`w-full h-5 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                                  trained
                                    ? "bg-green-500/30 border border-green-500/50 text-green-300"
                                    : isToday
                                    ? "bg-[#e94560]/20 border border-[#e94560]/50 text-[#e94560]"
                                    : isPast
                                    ? "bg-white/10 text-gray-600"
                                    : "bg-white/5 text-gray-700"
                                }`}
                              >
                                {trained ? "✓" : isToday ? "•" : ""}
                              </div>
                              <span className={`text-[8px] leading-none ${
                                isToday ? "text-gray-300 font-semibold" : isFuture ? "text-gray-700" : "text-gray-600"
                              }`}>
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {(() => {
                    const dow = getLocalDateParts().dayOfWeek; // 0=Sun
                    const daysLeftInWeek = dow === 0 ? 0 : 7 - dow; // 今日含まない残り日数
                    const needed = Math.max(0, data.weeklyGoal - data.weekCount);
                    if (needed === 0) return (
                      <p className="text-[10px] text-green-400/70 mt-1.5">
                        {data.weekCount > data.weeklyGoal
                          ? t("goal.extraWeek", { n: data.weekCount - data.weeklyGoal })
                          : t("goal.weeklyClear")}
                      </p>
                    );
                    if (daysLeftInWeek === 0) return (
                      <p className="text-[10px] text-gray-600 mt-1.5">{t("goal.zeroDaysLeft", { n: needed })}</p>
                    );
                    return (
                      <p className="text-[10px] text-gray-500 mt-1.5">
                        {t("goal.moreNeeded", { needed, days: daysLeftInWeek })}
                        {needed <= daysLeftInWeek ? t("goal.onTrackSuffix") : t("goal.pickUpPace")}
                      </p>
                    );
                  })()}
                  {/* Weekly achievement heatmap (past 4 weeks) */}
                  {weekHistory.length > 0 && (
                    <div className="mt-2.5">
                      <div className="flex items-center gap-1.5">
                        {weekHistory.map((w) => (
                          <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-0.5">
                            <div
                              className={`w-full h-6 rounded flex items-center justify-center text-[9px] font-bold transition-colors ${
                                w.isCurrent
                                  ? w.achieved
                                    ? "bg-green-500/30 border border-green-500/50 text-green-300"
                                    : "bg-[#e94560]/20 border border-[#e94560]/40 text-[#e94560]"
                                  : w.achieved
                                  ? "bg-green-500/25 text-green-400"
                                  : "bg-white/10 text-gray-600"
                              }`}
                            >
                              {w.achieved ? "✓" : w.count > 0 ? w.count : "-"}
                            </div>
                            <span className={`text-[8px] leading-none ${w.isCurrent ? "text-gray-300" : "text-gray-600"}`}>
                              {w.isCurrent ? t("goal.thisWeek") : weekHistory.indexOf(w) === weekHistory.length - 2 ? t("goal.lastWeek") : t("goal.weeksAgo", { n: weekHistory.length - 1 - weekHistory.indexOf(w) })}
                            </span>
                          </div>
                        ))}
                      </div>
                      {consecutiveAchievedWeeks >= 2 && (
                        <div className="mt-1.5 flex justify-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-green-500/15 border border-green-500/30 text-green-300 px-2 py-0.5 rounded-full">
                            {t("goal.weeksInRow", { n: consecutiveAchievedWeeks })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 mt-1">{t("goal.noGoal")}</p>
              )}
            </div>
          )}

          {/* Monthly Goal */}
          {editing === "monthly" ? (
            <GoalEditor
              header={t("goal.setMonthlyHeader")}
              currentDoneText={t("goal.currentDone", { n: data.monthCount })}
              sessionsLabel={t("goal.sessionsPicker")}
              cancelLabel={t("goal.cancel")}
              setLabel={t("goal.set")}
              current={data.monthCount}
              value={editValue}
              onChange={setEditValue}
              onSave={saveGoal}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => startEdit("monthly")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{t("goal.monthly")}</span>
                  {data.monthCount >= data.monthlyGoal && data.monthlyGoal > 0 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{t("goal.done")}</span>
                  )}
                </div>
                <button className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  {data.monthlyGoal > 0 ? t("goal.edit") : t("goal.plusSet")}
                </button>
              </div>
              {data.monthlyGoal > 0 ? (
                <>
                  <ProgressBar current={data.monthCount} target={data.monthlyGoal} sessionsUnit={t("chart.timesUnit")} doneLabel={t("goal.done")} />
                  {data.monthCount >= data.monthlyGoal ? (
                    <p className="text-[10px] text-green-400/70 mt-1.5">
                      {data.monthCount > data.monthlyGoal
                        ? t("goal.extraMonth", { n: data.monthCount - data.monthlyGoal })
                        : consecutiveAchievedMonths >= 2
                        ? t("goal.consecutiveMonths", { n: consecutiveAchievedMonths })
                        : t("goal.monthlyAchieved")}
                    </p>
                  ) : data.monthCount < data.monthlyGoal && remainingDaysInMonth > 0 && (
                    <p className="text-[10px] mt-1 text-gray-500">
                      {t("goal.moreNeeded", { needed: data.monthlyGoal - data.monthCount, days: remainingDaysInMonth })}
                      {monthlyProjected > 0 ? (
                        <span className={monthOnTrack ? "text-green-400/80" : "text-orange-400/80"}>
                          {monthOnTrack ? t("goal.onTrack") : t("goal.onPaceFor", { n: monthlyProjected })}
                        </span>
                      ) : null}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 mt-1">{t("goal.noGoal")}</p>
              )}
            </div>
          )}

          {/* Technique Goal */}
          {editing === "technique" ? (
            <GoalEditor
              header={t("goal.setTechniqueHeader")}
              currentDoneText={t("goal.currentDone", { n: data.techniqueCount })}
              sessionsLabel={t("goal.sessionsPicker")}
              cancelLabel={t("goal.cancel")}
              setLabel={t("goal.set")}
              current={data.techniqueCount}
              value={editValue}
              onChange={(v) => setEditValue(Math.min(500, v))}
              onSave={saveGoal}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => startEdit("technique")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{t("goal.technique")}</span>
                  {data.techniqueCount >= data.techniqueGoal && data.techniqueGoal > 0 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{t("goal.done")}</span>
                  )}
                </div>
                <button className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  {data.techniqueGoal > 0 ? t("goal.edit") : t("goal.plusSet")}
                </button>
              </div>
              {data.techniqueGoal > 0 ? (
                <ProgressBar current={data.techniqueCount} target={data.techniqueGoal} sessionsUnit={t("chart.timesUnit")} doneLabel={t("goal.done")} />
              ) : (
                <p className="text-xs text-gray-600 mt-1">{t("goal.noGoalParen")}</p>
              )}
            </div>
          )}
        </div>

        {/* Monthly achievement history badges (when monthly goal is set) */}
        {monthHistory.length > 0 && (
          <div className="border-t border-white/10 px-4 py-3">
            <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">{t("goal.past6Months")}</p>
            <div className="flex items-end justify-between gap-1">
              {monthHistory.map((m) => (
                <div key={m.ym} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      m.achieved
                        ? "bg-green-500 text-white shadow-sm shadow-green-500/40"
                        : "bg-white/10 text-gray-500"
                    }`}
                  >
                    {m.achieved ? "✓" : m.count}
                  </div>
                  <span className={`text-[9px] ${m.achieved ? "text-green-400" : "text-gray-600"}`}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-2 text-center">
              {t("goal.monthsAchieved", { n: monthHistory.filter((m) => m.achieved).length })}
            </p>
          </div>
        )}
        </>)}
      </div>
    </>
  );
}

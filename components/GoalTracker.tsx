"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";
import { useLocale } from "@/lib/i18n";
import { hapticTap } from "@/lib/haptics";
import Skeleton from "@/components/ui/Skeleton";
import { getLocalDateParts, getWeekStartDate, getMonthStartDate } from "@/lib/timezone";
import {
  type GoalData,
  type MonthHistory,
  type WeekHistory,
  ProgressBar,
  GoalEditor,
} from "./GoalTrackerEditor";
import {
  GoalWeekDayGrid,
  GoalDaysLeftText,
  GoalWeekHeatmap,
  GoalMonthHistoryBadges,
} from "./GoalTrackerGrid";

type Props = {
  userId: string;
};

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
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [monthHistory, setMonthHistory] = useState<MonthHistory[]>([]);
  const [weekHistory, setWeekHistory] = useState<WeekHistory[]>([]);
  const [currentWeekDayGrid, setCurrentWeekDayGrid] = useState<boolean[]>(Array(7).fill(false));
  const [isOpen, setIsOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      try {
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
          return;
        }

        const mGoal = (profileRes.data as { monthly_goal?: number } | null)?.monthly_goal ?? 0;

        setData({
          weeklyGoal: (profileRes.data as { weekly_goal?: number } | null)?.weekly_goal ?? 0,
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

          const { data: wLogs , error } = await supabase
            .from("training_logs")
            .select("date")
            .eq("user_id", userId)
            .gte("date", fourWeeksAgoStr);
          if (error) console.error("GoalTracker.tsx:query", error);

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
              label: i === 0 ? t("goal.thisWeek") : i === 1 ? t("goal.lastWeek") : t("goal.weeksAgo", { n: i }),
              count: cnt,
              achieved: cnt >= wGoal,
              isCurrent: i === 0,
            });
          }
          setWeekHistory(wh);
        }

        // 過去6ヶ月の達成履歴を計算（N+1解消: 1クエリで全件取得→client側で月集計）
        if (mGoal > 0) {
          const { year: nowYear, month: nowMonth } = getLocalDateParts();
          const sixMonthsAgo = new Date(Date.UTC(nowYear, nowMonth - 1 - 5, 1));
          const sixMonthsAgoStr = `${sixMonthsAgo.getUTCFullYear()}-${String(sixMonthsAgo.getUTCMonth() + 1).padStart(2, "0")}-01`;
          const { data: mLogs , error } = await supabase
            .from("training_logs")
            .select("date")
            .eq("user_id", userId)
            .gte("date", sixMonthsAgoStr);
          if (error) console.error("GoalTracker.tsx:query", error);
          const history: MonthHistory[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(Date.UTC(nowYear, nowMonth - 1 - i, 1));
            const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            const hc = (mLogs ?? []).filter((l) => l.date.startsWith(ym)).length;
            history.push({
              ym,
              label: `${d.getUTCMonth() + 1}`,
              count: hc,
              achieved: hc >= mGoal,
            });
          }
          setMonthHistory(history);
        }
      } catch {
        // Network/auth error — show empty state gracefully
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Onboarding: when navigated to via #goal-tracker hash, auto-expand + open weekly goal editor
  useEffect(() => {
    const handleGoalHash = () => {
      if (window.location.hash === "#goal-tracker") {
        setIsOpen(true);
        setEditValue(0);
        setEditing("weekly");
        // Smooth scroll to self (hash handles it, but ensure visibility)
        setTimeout(() => {
          document.getElementById("goal-tracker")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 50);
        // Clear hash so repeat clicks work
        history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    };
    handleGoalHash(); // check on mount (page load with hash)
    window.addEventListener("hashchange", handleGoalHash);
    return () => window.removeEventListener("hashchange", handleGoalHash);
  }, []);

  const startEdit = (type: "weekly" | "monthly" | "technique") => {
    setEditValue(
      type === "weekly" ? data.weeklyGoal
      : type === "monthly" ? data.monthlyGoal
      : data.techniqueGoal
    );
    setEditing(type);
  };

  const saveGoal = async () => {
    if (!editing || isSaving) return;
    setIsSaving(true);
    const col = editing === "weekly" ? "weekly_goal"
      : editing === "monthly" ? "monthly_goal"
      : "technique_goal";
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, [col]: editValue }, { onConflict: "id" });

    if (!error) {
      hapticTap();
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
    setIsSaving(false);
  };

  if (loading) return <Skeleton height={200} rounded="2xl" className="mb-4" />;

  if (!schemaReady) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 mb-4 shadow-lg shadow-black/40">
        <p className="text-xs text-zinc-400 text-center">
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
      <div id="goal-tracker" className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-white/10 mb-4 overflow-hidden shadow-lg shadow-black/40">
        <button
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors text-left"
        >
          <h4 className="text-sm font-medium text-gray-300">{t("goal.title")}</h4>
          <div className="flex items-center gap-2">
            {!isOpen && hasGoals && (
              <span className="text-xs text-zinc-400">
                {[
                  data.weeklyGoal > 0 ? t("goal.compactWeekly", { a: data.weekCount, b: data.weeklyGoal }) : "",
                  data.monthlyGoal > 0 ? t("goal.compactMonthly", { a: data.monthCount, b: data.monthlyGoal }) : "",
                ].filter(Boolean).join(" · ")}
              </span>
            )}
            {!isOpen && !hasGoals && (
              <span className="text-xs text-zinc-400">{t("goal.setAGoal")}</span>
            )}
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
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
              .cf-p:nth-child(1){left:6%;  background:#f97316; animation-duration:1.3s; animation-delay:0s;}
              .cf-p:nth-child(2){left:17%; background:#4ade80; animation-duration:1.5s; animation-delay:.15s;}
              .cf-p:nth-child(3){left:29%; background:#facc15; animation-duration:1.2s; animation-delay:.05s;}
              .cf-p:nth-child(4){left:41%; background:#60a5fa; animation-duration:1.6s; animation-delay:.3s;}
              .cf-p:nth-child(5){left:54%; background:#a78bfa; animation-duration:1.4s; animation-delay:.1s;}
              .cf-p:nth-child(6){left:66%; background:#a78bfa; animation-duration:1.3s; animation-delay:.25s;}
              .cf-p:nth-child(7){left:78%; background:#4ade80; animation-duration:1.5s; animation-delay:.4s;}
              .cf-p:nth-child(8){left:90%; background:#facc15; animation-duration:1.2s; animation-delay:.2s;}
            `}</style>
            <div className="cf-p"/><div className="cf-p"/><div className="cf-p"/><div className="cf-p"/>
            <div className="cf-p"/><div className="cf-p"/><div className="cf-p"/><div className="cf-p"/>
            <div className="text-2xl mb-1 animate-bounce">🎉</div>
            <div className="text-sm font-bold text-green-400">{t("goal.allAchieved")}</div>
            <div className="text-xs text-gray-400 mt-1">
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
              saving={isSaving}
            />
          ) : (
            <div
              className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => startEdit("weekly")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEdit("weekly");
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{t("goal.weekly")}</span>
                  {data.weekCount >= data.weeklyGoal && data.weeklyGoal > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{t("goal.done")}</span>
                  )}
                </div>
                <button className="text-xs text-zinc-400 hover:text-gray-300 transition-colors">
                  {data.weeklyGoal > 0 ? t("goal.edit") : t("goal.plusSet")}
                </button>
              </div>
              {data.weeklyGoal > 0 ? (
                <>
                  <ProgressBar current={data.weekCount} target={data.weeklyGoal} sessionsUnit={t("chart.timesUnit")} doneLabel={t("goal.done")} />
                  <GoalWeekDayGrid currentWeekDayGrid={currentWeekDayGrid} />
                  <GoalDaysLeftText weeklyGoal={data.weeklyGoal} weekCount={data.weekCount} />
                  <GoalWeekHeatmap weekHistory={weekHistory} consecutiveAchievedWeeks={consecutiveAchievedWeeks} />
                </>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">{t("goal.noGoal")}</p>
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
              saving={isSaving}
            />
          ) : (
            <div
              className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => startEdit("monthly")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEdit("monthly");
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{t("goal.monthly")}</span>
                  {data.monthCount >= data.monthlyGoal && data.monthlyGoal > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{t("goal.done")}</span>
                  )}
                </div>
                <button className="text-xs text-zinc-400 hover:text-gray-300 transition-colors">
                  {data.monthlyGoal > 0 ? t("goal.edit") : t("goal.plusSet")}
                </button>
              </div>
              {data.monthlyGoal > 0 ? (
                <>
                  <ProgressBar current={data.monthCount} target={data.monthlyGoal} sessionsUnit={t("chart.timesUnit")} doneLabel={t("goal.done")} />
                  {data.monthCount >= data.monthlyGoal ? (
                    <p className="text-xs text-green-400 mt-1.5">
                      {data.monthCount > data.monthlyGoal
                        ? t("goal.extraMonth", { n: data.monthCount - data.monthlyGoal })
                        : consecutiveAchievedMonths >= 2
                        ? t("goal.consecutiveMonths", { n: consecutiveAchievedMonths })
                        : t("goal.monthlyAchieved")}
                    </p>
                  ) : data.monthCount < data.monthlyGoal && remainingDaysInMonth > 0 && (
                    <p className="text-xs mt-1 text-zinc-400">
                      {t("goal.moreNeeded", { needed: data.monthlyGoal - data.monthCount, days: remainingDaysInMonth })}
                      {monthlyProjected > 0 ? (
                        <span className={monthOnTrack ? "text-green-400" : "text-orange-400"}>
                          {monthOnTrack ? t("goal.onTrack") : t("goal.onPaceFor", { n: monthlyProjected })}
                        </span>
                      ) : null}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">{t("goal.noGoal")}</p>
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
              saving={isSaving}
            />
          ) : (
            <div
              className="bg-white/5 rounded-xl px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => startEdit("technique")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  startEdit("technique");
                }
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">{t("goal.technique")}</span>
                  {data.techniqueCount >= data.techniqueGoal && data.techniqueGoal > 0 && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">{t("goal.done")}</span>
                  )}
                </div>
                <button className="text-xs text-zinc-400 hover:text-gray-300 transition-colors">
                  {data.techniqueGoal > 0 ? t("goal.edit") : t("goal.plusSet")}
                </button>
              </div>
              {data.techniqueGoal > 0 ? (
                <ProgressBar current={data.techniqueCount} target={data.techniqueGoal} sessionsUnit={t("chart.timesUnit")} doneLabel={t("goal.done")} />
              ) : (
                <p className="text-xs text-zinc-400 mt-1">{t("goal.noGoalParen")}</p>
              )}
            </div>
          )}
        </div>

        <GoalMonthHistoryBadges monthHistory={monthHistory} />
        </>)}
      </div>
    </>
  );
}

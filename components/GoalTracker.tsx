"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

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
  ym: string;
  label: string;
  count: number;
  achieved: boolean;
};

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const done = current >= target && target > 0;
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-bold ${done ? "text-green-400" : "text-[#e94560]"}`}>
          {current} / {target}回
        </span>
        <span className={`text-[11px] ${done ? "text-green-400" : "text-gray-500"}`}>
          {done ? "✓ 達成！" : `${pct}%`}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            done ? "bg-green-400" : pct >= 70 ? "bg-yellow-400" : "bg-[#e94560]"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GoalEditor({
  label,
  current,
  value,
  onChange,
  onSave,
  onCancel,
}: {
  label: string;
  current: number;
  value: number;
  onChange: (v: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4 border border-[#e94560]/30">
      <div className="text-xs text-gray-400 mb-3">{label}の目標を設定</div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 rounded-lg bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 transition-colors"
        >
          −
        </button>
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold text-white">{value}</span>
          <span className="text-gray-400 text-sm ml-1">回</span>
        </div>
        <button
          onClick={() => onChange(Math.min(30, value + 1))}
          className="w-9 h-9 rounded-lg bg-gray-700 text-white text-lg font-bold hover:bg-gray-600 transition-colors"
        >
          ＋
        </button>
      </div>
      {value > 0 && (
        <div className="text-xs text-gray-500 text-center mb-3">
          現在: {current}回 達成済み
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 text-sm hover:bg-gray-600 transition-colors"
        >
          キャンセル
        </button>
        <button
          onClick={onSave}
          disabled={value === 0}
          className="flex-1 py-2 rounded-lg bg-[#e94560] text-white text-sm font-semibold hover:bg-[#c73652] disabled:opacity-40 transition-colors"
        >
          設定する
        </button>
      </div>
    </div>
  );
}

export default function GoalTracker({ userId }: Props) {
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

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const firstDayOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const firstDayOfWeek = new Date(now.getTime() - daysToMonday * 86400000)
        .toISOString()
        .split("T")[0];

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

      if (mGoal > 0) {
        const history: MonthHistory[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const nextYm = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, "0")}-01`;
          const { count: hc } = await supabase
            .from("training_logs")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("date", `${ym}-01`)
            .lt("date", nextYm);
          history.push({
            ym,
            label: `${d.getMonth() + 1}月`,
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
      setToast({ message: "目標を設定しました！", type: "success" });
    } else {
      setToast({ message: "保存に失敗しました", type: "error" });
    }
    setEditing(null);
  };

  if (loading) return null;

  if (!schemaReady) {
    return (
      <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
        <p className="text-xs text-gray-500 text-center">
          目標トラッキングを有効にするには、Supabaseで
          <code className="text-yellow-400 mx-1">supabase-goals-schema.sql</code>
          を実行してください。
        </p>
      </div>
    );
  }

  const hasGoals = data.weeklyGoal > 0 || data.monthlyGoal > 0 || data.techniqueGoal > 0;

  const activeGoalStates = [
    { target: data.weeklyGoal, current: data.weekCount },
    { target: data.monthlyGoal, current: data.monthCount },
    { target: data.techniqueGoal, current: data.techniqueCount },
  ].filter((g) => g.target > 0);
  const allGoalsAchieved = hasGoals && activeGoalStates.length > 0 && activeGoalStates.every((g) => g.current >= g.target);
  // Sparkle animation on first achievement
  const [sparkle, setSparkle] = useState(false);
  const prevAchieved = useRef(false);
  useEffect(() => {
    if (allGoalsAchieved && !prevAchieved.current) {
      setSparkle(true);
      const timer = setTimeout(() => setSparkle(false), 3000);
      prevAchieved.current = true;
      return () => clearTimeout(timer);
    }
    if (!allGoalsAchieved) prevAchieved.current = false;
  }, [allGoalsAchieved]);

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <div className="bg-[#16213e] rounded-xl border border-gray-700 mb-4 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h4 className="text-sm font-medium text-gray-300">🎯 練習目標</h4>
          {!hasGoals && (
            <span className="text-[10px] text-gray-600">目標を設定して継続を管理しよう</span>
          )}
        </div>

        {allGoalsAchieved && !editing && (
          <div className={`mx-4 mt-3 rounded-xl bg-green-500/10 border px-4 py-3 text-center transition-all duration-500 ${sparkle ? "border-green-400 shadow-lg shadow-green-500/20" : "border-green-500/30"}`}>
            <div className={`text-2xl mb-0.5 ${sparkle ? "animate-bounce" : ""}`}>🎉</div>
            <div className="text-sm font-semibold text-green-400">全目標達成！</div>
            <div className="text-[11px] text-gray-400 mt-0.5">素晴らしい！この調子で続けよう</div>
            {sparkle && (
              <div className="text-xs text-green-300 mt-1 animate-pulse">✨ おめでとう！✨</div>
            )}
          </div>
        )}

        <div className="p-4 space-y-3">
          {editing === "weekly" ? (
            <GoalEditor
              label="今週"
              current={data.weekCount}
              value={editValue}
              onChange={setEditValue}
              onSave={saveGoal}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              className="bg-gray-800/40 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-800/60 transition-colors"
              onClick={() => startEdit("weekly")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">今週の目標</span>
                  {data.weekCount >= data.weeklyGoal && data.weeklyGoal > 0 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">達成！</span>
                  )}
                </div>
                <button className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  {data.weeklyGoal > 0 ? "変更" : "＋ 設定"}
                </button>
              </div>
              {data.weeklyGoal > 0 ? (
                <ProgressBar current={data.weekCount} target={data.weeklyGoal} />
              ) : (
                <p className="text-xs text-gray-600 mt-1">目標未設定（タップして設定）</p>
              )}
            </div>
          )}

          {editing === "monthly" ? (
            <GoalEditor
              label="今月"
              current={data.monthCount}
              value={editValue}
              onChange={setEditValue}
              onSave={saveGoal}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              className="bg-gray-800/40 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-800/60 transition-colors"
              onClick={() => startEdit("monthly")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">今月の目標</span>
                  {data.monthCount >= data.monthlyGoal && data.monthlyGoal > 0 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">達成！</span>
                  )}
                </div>
                <button className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  {data.monthlyGoal > 0 ? "変更" : "＋ 設定"}
                </button>
              </div>
              {data.monthlyGoal > 0 ? (
                <ProgressBar current={data.monthCount} target={data.monthlyGoal} />
              ) : (
                <p className="text-xs text-gray-600 mt-1">目標未設定（タップして設定）</p>
              )}
            </div>
          )}

          {editing === "technique" ? (
            <GoalEditor
              label="テクニック習得数"
              current={data.techniqueCount}
              value={editValue}
              onChange={(v) => setEditValue(Math.min(500, v))}
              onSave={saveGoal}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <div
              className="bg-gray-800/40 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-800/60 transition-colors"
              onClick={() => startEdit("technique")}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">🥋 テクニック目標</span>
                  {data.techniqueCount >= data.techniqueGoal && data.techniqueGoal > 0 && (
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">達成！</span>
                  )}
                </div>
                <button className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                  {data.techniqueGoal > 0 ? "変更" : "＋ 設定"}
                </button>
              </div>
              {data.techniqueGoal > 0 ? (
                <ProgressBar current={data.techniqueCount} target={data.techniqueGoal} />
              ) : (
                <p className="text-xs text-gray-600 mt-1">目標未設定（タップして設定）</p>
              )}
            </div>
          )}
        </div>

        {monthHistory.length > 0 && (
          <div className="border-t border-gray-700 px-4 py-3">
            <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wider">過去6ヶ月の達成履歴</p>
            <div className="flex items-end justify-between gap-1">
              {monthHistory.map((m) => (
                <div key={m.ym} className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      m.achieved
                        ? "bg-green-500 text-white shadow-sm shadow-green-500/40"
                        : "bg-gray-700 text-gray-500"
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
              {monthHistory.filter((m) => m.achieved).length} / 6ヶ月 達成
            </p>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

type Props = { userId: string; streak: number };

export default function StreakFreeze({ userId, streak }: Props) {
  const [freezeCount, setFreezeCount] = useState(0);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("streak_freeze_count, streak_freeze_last_used")
        .eq("id", userId)
        .single();
      setFreezeCount(data?.streak_freeze_count ?? 0);
      setLastUsed(data?.streak_freeze_last_used ?? null);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const today = new Date().toLocaleDateString("sv-SE");
  const usedToday = lastUsed === today;
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE");

  const [hadYesterdayLog, setHadYesterdayLog] = useState<boolean | null>(null);

  useEffect(() => {
    const checkYesterday = async () => {
      const { count } = await supabase
        .from("training_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("date", yesterday);
      setHadYesterdayLog((count ?? 0) > 0);
    };
    checkYesterday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const useFreeze = async () => {
    if (freezeCount <= 0 || usedToday || using) return;
    setUsing(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            streak_freeze_count: Math.max(0, freezeCount - 1),
            streak_freeze_last_used: today,
          },
          { onConflict: "id" }
        );
      if (!error) {
        setFreezeCount((prev) => Math.max(0, prev - 1));
        setLastUsed(today);
        setToast({ message: "❄️ ストリークフリーズを使用しました！連続記録が守られます。", type: "success" });
      } else {
        setToast({ message: "使用に失敗しました。後でお試しください。", type: "error" });
      }
    } finally {
      setUsing(false);
    }
  };

  if (loading || hadYesterdayLog === null) return null;
  if (dismissed) return null;

  const showWarning = streak >= 3 && !hadYesterdayLog && !usedToday;
  const showStatus = streak >= 1 && !showWarning;

  if (!showWarning && !showStatus && freezeCount === 0) return null;

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {showWarning && (
        <div className="bg-[#1a1a2e] border border-blue-500/40 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span className="text-xl mt-0.5">❄️</span>
              <div>
                <p className="text-sm font-semibold text-blue-300">
                  {streak}日連続が危険！ストリークフリーズ使用可能
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  昨日の記録がありません。フリーズを使って連続記録を守りましょう。
                </p>
                <p className="text-[11px] text-blue-400 mt-1">残り {freezeCount} 回使用可能</p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-600 hover:text-gray-400 text-lg leading-none"
            >
              ✕
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={useFreeze}
              disabled={freezeCount <= 0 || using}
              className="flex-1 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors"
            >
              {using ? "使用中…" : `❄️ フリーズを使う (残${freezeCount})`}
            </button>
          </div>
        </div>
      )}

      {showStatus && freezeCount > 0 && (
        <div className="bg-[#16213e] rounded-xl px-4 py-3 mb-4 border border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">❄️</span>
            <div>
              <p className="text-xs font-medium text-gray-300">ストリークフリーズ</p>
              {lastUsed ? (
                <p className="text-[11px] text-gray-500">
                  最終使用: {lastUsed.slice(5, 7)}月{lastUsed.slice(8, 10)}日
                </p>
              ) : (
                <p className="text-[11px] text-gray-500">緊急時に連続記録を守れます</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(3, freezeCount) }).map((_, i) => (
              <span key={i} className="text-blue-400 text-base">❄️</span>
            ))}
            {freezeCount > 3 && (
              <span className="text-[11px] text-blue-400">+{freezeCount - 3}</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

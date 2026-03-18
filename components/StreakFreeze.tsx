"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

const STRIPE_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";

type Props = { userId: string; streak: number };

// streak_freeze_last_used カラムを JSON 配列文字列として再利用
// 例: '["2026-03-17","2026-03-15","2026-03-10"]'
// 旧形式（"2026-03-17" 単独文字列）は後方互換で処理

function parseHistory(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, 3);
    return [raw]; // 旧形式
  } catch {
    return raw ? [raw] : []; // 旧形式
  }
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

export default function StreakFreeze({ userId, streak }: Props) {
  const [freezeCount, setFreezeCount] = useState(0);
  const [historyDates, setHistoryDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [using, setUsing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isPro, setIsPro] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("streak_freeze_count, streak_freeze_last_used, is_pro")
        .eq("id", userId)
        .single();
      setFreezeCount(data?.streak_freeze_count ?? 0);
      setHistoryDates(parseHistory(data?.streak_freeze_last_used ?? null));
      setIsPro(data?.is_pro ?? false);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const today = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("sv-SE");
  const usedToday = historyDates[0] === today;

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
      // 新しい使用日を先頭に追加し、最大3件保持
      const newHistory = [today, ...historyDates].slice(0, 3);
      const { error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            streak_freeze_count: Math.max(0, freezeCount - 1),
            streak_freeze_last_used: JSON.stringify(newHistory),
          },
          { onConflict: "id" }
        );
      if (!error) {
        setFreezeCount((prev) => Math.max(0, prev - 1));
        setHistoryDates(newHistory);
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

      {/* 危機警告 + フリーズ使用 */}
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
                {historyDates.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    直近の使用: {historyDates.map(fmtDate).join(" / ")}
                  </p>
                )}
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

      {/* ステータス表示（危機でない時） */}
      {showStatus && freezeCount > 0 && (
        <div className="bg-[#16213e] rounded-xl px-4 py-3 mb-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">❄️</span>
              <div>
                <p className="text-xs font-medium text-gray-300">ストリークフリーズ</p>
                <p className="text-[11px] text-gray-500">緊急時に連続記録を守れます</p>
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
          {/* 直近の使用履歴 */}
          {historyDates.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <p className="text-[10px] text-gray-500">
                直近の使用:{" "}
                {historyDates.map((d, i) => (
                  <span key={i}>
                    <span className={i === 0 ? "text-blue-400" : "text-gray-600"}>
                      {fmtDate(d)}
                    </span>
                    {i < historyDates.length - 1 && (
                      <span className="text-gray-700"> · </span>
                    )}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
      )}

      {/* フリーズ残量0 → Proアップグレード CTA */}
      {showStatus && freezeCount === 0 && !isPro && streak >= 3 && (
        <div className="bg-[#16213e] rounded-xl px-4 py-3 mb-4 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base opacity-40">❄️</span>
              <div>
                <p className="text-xs font-medium text-gray-400">ストリークフリーズ残量: 0</p>
                <p className="text-[11px] text-gray-600">Proプランで無制限フリーズ取得</p>
              </div>
            </div>
            <a
              href={userId ? `${STRIPE_PAYMENT_LINK}?client_reference_id=${userId}` : STRIPE_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] bg-[#e94560]/80 hover:bg-[#e94560] text-white px-3 py-1.5 rounded-lg transition-colors font-semibold whitespace-nowrap"
              onClick={() => {
                if (typeof gtag !== "undefined") {
                  gtag("event", "upgrade_click", { feature: "streak_freeze_refill" });
                }
              }}
            >
              Pro へ ↗
            </a>
          </div>
        </div>
      )}
    </>
  );
}

// Type declaration for gtag
declare function gtag(
  command: string,
  action: string,
  params?: Record<string, string>
): void;

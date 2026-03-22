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

  // JST日付（sv-SEではなくUTC+9で統一）
  const toJSTStr = (d: Date): string =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const today = toJSTStr(new Date(Date.now() + 9 * 3600000));
  const yesterday = toJSTStr(new Date(Date.now() + 9 * 3600000 - 86400000));
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
        setToast({ message: "❄️ Streak Freeze used! Your streak is saved.", type: "success" });
      } else {
        setToast({ message: "Failed to use. Please try again later.", type: "error" });
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
        <div className="bg-[#0f172a] border border-blue-500/40 rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <span className="text-xl mt-0.5">❄️</span>
              <div>
                <p className="text-sm font-semibold text-blue-300">
                  {streak}-day streak at risk! Streak Freeze available
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  No training logged yesterday. Use a freeze to protect your streak.
                </p>
                <p className="text-[11px] text-blue-400 mt-1">{freezeCount} uses remaining</p>
                {historyDates.length > 0 && (
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Recent usage: {historyDates.map(fmtDate).join(" / ")}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-600 hover:text-gray-400 text-lg leading-none"
              aria-label="Close"
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
              {using ? "Using..." : `❄️ Use Freeze (${freezeCount} left)`}
            </button>
          </div>
        </div>
      )}

      {/* ステータス表示（危機でない時） */}
      {showStatus && freezeCount > 0 && (
        <div className="bg-zinc-900 rounded-xl px-4 py-3 mb-4 border border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">❄️</span>
              <div>
                <p className="text-xs font-medium text-gray-300">Streak Freeze</p>
                <p className="text-[11px] text-gray-500">Protects your streak in emergencies</p>
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
          {/* Recent usage history */}
          {historyDates.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/5">
              <p className="text-[10px] text-gray-500">
                Recent usage:{" "}
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

      {/* Freeze count 0 → Pro upgrade CTA */}
      {showStatus && freezeCount === 0 && !isPro && streak >= 3 && (
        <div className="bg-zinc-900 rounded-xl px-4 py-3 mb-4 border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base opacity-40">❄️</span>
              <div>
                <p className="text-xs font-medium text-gray-400">Streak Freeze: 0 remaining</p>
                <p className="text-[11px] text-gray-600">Get unlimited freezes with Pro</p>
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
              Go Pro ↗
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

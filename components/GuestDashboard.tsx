"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/lib/i18n";
import LangToggle from "./LangToggle";

type GuestLog = {
  id: string;
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  created_at: string;
};

const TRAINING_TYPES = [
  { value: "gi", label: "Gi", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  { value: "nogi", label: "NoGi", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  { value: "drilling", label: "ドリル", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  { value: "competition", label: "試合", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  { value: "open_mat", label: "オープンマット", color: "bg-green-500/20 text-green-300 border-green-500/40" },
];

const STORAGE_KEY = "bjj_guest_logs";
const DURATION_PRESETS = [30, 60, 90, 120];

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadGuestLogs(): GuestLog[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveGuestLogs(logs: GuestLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export default function GuestDashboard() {
  const router = useRouter();
  const { t } = useLocale();
  const [logs, setLogs] = useState<GuestLog[]>([]);
  const [date, setDate] = useState(getLocalDateString());
  const [duration, setDuration] = useState(60);
  const [type, setType] = useState("gi");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    setLogs(loadGuestLogs());
  }, []);

  const handleAdd = () => {
    const newLog: GuestLog = {
      id: crypto.randomUUID(),
      date,
      duration_min: duration,
      type,
      notes,
      created_at: new Date().toISOString(),
    };
    const updated = [newLog, ...logs];
    setLogs(updated);
    saveGuestLogs(updated);
    setNotes("");
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    saveGuestLogs(updated);
  };

  const typeInfo = (t: string) => TRAINING_TYPES.find((tt) => tt.value === t) ?? TRAINING_TYPES[0];

  return (
    <div className="min-h-screen bg-[#1a1a2e] pb-20 sm:pb-0">
      {/* ゲストバナー */}
      <div className="bg-gradient-to-r from-[#e94560]/90 to-[#0f3460]/90 px-4 py-3 text-center">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <p className="text-white text-sm font-medium flex-1 text-center">
            🥋 {t("guest.banner")} —
            <Link href="/login" className="underline ml-1 font-bold">
              {t("guest.signupLink")}
            </Link>
            {t("guest.saveToCloud")}
          </p>
          <LangToggle />
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{t("guest.welcome")}</h2>
          <p className="text-gray-400 text-sm mt-1">
            {t("guest.noLogin")}
          </p>
        </div>

        {/* ゲストステータス */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-bold text-[#e94560]">{logs.length}</div>
            <div className="text-gray-400 text-xs mt-1">{t("guest.sessions")}</div>
          </div>
          <div className="bg-[#16213e] rounded-xl p-4 text-center border border-gray-700">
            <div className="text-2xl font-bold text-yellow-400">
              {logs.reduce((s, l) => s + l.duration_min, 0)}
            </div>
            <div className="text-gray-400 text-xs mt-1">{t("guest.totalMins")}</div>
          </div>
        </div>

        {/* 練習記録セクション */}
        <div className="bg-[#16213e] rounded-xl border border-gray-700 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">{t("training.title")}</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-[#e94560] hover:bg-[#c73652] text-white text-sm font-bold px-4 py-1.5 rounded-lg"
            >
              {showForm ? t("training.cancel") : t("training.add")}
            </button>
          </div>

          {/* 入力フォーム */}
          {showForm && (
            <div className="space-y-3 mb-4 border border-gray-600 rounded-xl p-4 bg-[#0f3460]/30">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={date}
                  max={getLocalDateString()}
                  onChange={(e) => setDate(e.target.value)}
                  className="flex-1 bg-[#0f3460] text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-400"
                />
              </div>
              {/* 時間プリセット */}
              <div>
                <p className="text-gray-400 text-xs mb-1.5">練習時間</p>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        duration === d
                          ? "bg-[#e94560] border-[#e94560] text-white"
                          : "bg-[#0f3460] border-gray-600 text-gray-400 hover:text-white"
                      }`}
                    >
                      {d}分
                    </button>
                  ))}
                </div>
              </div>
              {/* タイプ */}
              <div className="flex gap-2 flex-wrap">
                {TRAINING_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      type === t.value ? t.color + " ring-1 ring-white/30" : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="メモ（任意）"
                className="w-full bg-[#0f3460] text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={handleAdd}
                className="w-full bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-2 rounded-lg text-sm"
              >
                記録する
              </button>
            </div>
          )}

          {/* ログ一覧 */}
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">🥋</p>
              <p className="text-sm">{t("training.empty")}</p>
              <p className="text-xs mt-1">{t("training.emptyDesc")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between bg-[#0f3460]/40 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeInfo(log.type).color}`}>
                      {typeInfo(log.type).label}
                    </span>
                    <span className="text-white text-sm">{log.date}</span>
                    <span className="text-gray-400 text-xs">{log.duration_min}分</span>
                    {log.notes && <span className="text-gray-500 text-xs truncate">{log.notes}</span>}
                  </div>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="text-gray-600 hover:text-red-400 ml-2 flex-shrink-0 text-lg leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 登録CTAカード（3回以上練習したら強調表示） */}
        <div className={`rounded-xl border p-5 text-center transition-all ${
          logs.length >= 3
            ? "bg-gradient-to-br from-[#e94560]/20 to-[#0f3460] border-[#e94560]/50"
            : "bg-[#16213e] border-gray-700"
        }`}>
          {logs.length >= 3 && (
            <p className="text-[#e94560] text-sm font-semibold mb-1">
              {t("guest.ctaRecorded", { n: logs.length })}
            </p>
          )}
          <p className="text-white font-semibold mb-1">
            {t("guest.ctaTitle")}
          </p>
          <p className="text-gray-400 text-xs mb-4">
            {t("guest.ctaDesc")}
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#e94560] hover:bg-[#c73652] text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
          >
            {t("guest.ctaButton")}
          </Link>
          <p className="text-gray-600 text-xs mt-2">
            {t("guest.ctaNote")}
          </p>
        </div>
      </main>
    </div>
  );
}

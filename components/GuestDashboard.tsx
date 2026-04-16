"use client";

import { useState, useEffect, useRef } from "react";
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

const TRAINING_TYPE_VALUES = [
  { value: "gi", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  { value: "nogi", color: "bg-orange-500/20 text-orange-300 border-orange-500/40" },
  { value: "drilling", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
  { value: "competition", color: "bg-red-500/20 text-red-300 border-red-500/40" },
  { value: "open_mat", color: "bg-green-500/20 text-green-300 border-green-500/40" },
] as const;

const STORAGE_KEY = "bjj_guest_logs";
const DURATION_PRESETS = [30, 60, 90, 120];

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getYesterdayLocalDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
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
  const logsRef = useRef<GuestLog[]>([]);
  logsRef.current = logs; // always reflects latest state (stale closure defence)
  const [date, setDate] = useState(getLocalDateString());
  const [duration, setDuration] = useState(60);
  const [type, setType] = useState("gi");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [continuousInput, setContinuousInput] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; entry: GuestLog; timerId: ReturnType<typeof setTimeout> } | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  // Locale-aware training types (labels from i18n)
  const TRAINING_TYPES = TRAINING_TYPE_VALUES.map((tt) => ({
    ...tt,
    label: t(`training.${tt.value}` as Parameters<typeof t>[0]),
  }));

  useEffect(() => {
    setLogs(loadGuestLogs());
  }, []);

  const handleAdd = () => {
    if (saving) return; // multi-tap guard
    setSaving(true);
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
    setSaving(false);
    if (continuousInput) {
      // Keep form open with date/duration/type preserved; only notes cleared
    } else {
      setShowForm(false);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  };

  const handleDelete = (id: string) => {
    const removed = logs.find((l) => l.id === id);
    if (!removed) return;
    // Cancel any previous pending delete first
    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      saveGuestLogs(logs.filter((l) => l.id !== pendingDelete.id));
    }
    // Optimistic remove from UI
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setUndoVisible(true);
    const timerId = setTimeout(() => {
      // Use logsRef.current (not stale closure `logs`) to get the latest state
      saveGuestLogs(logsRef.current.filter((l) => l.id !== id));
      setPendingDelete(null);
      setUndoVisible(false);
    }, 4000);
    setPendingDelete({ id, entry: removed, timerId });
  };

  const handleUndoDelete = () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    setLogs((prev) => {
      const restored = [pendingDelete.entry, ...prev];
      restored.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return restored;
    });
    setPendingDelete(null);
    setUndoVisible(false);
  };

  const typeInfo = (t: string) => TRAINING_TYPES.find((tt) => tt.value === t) ?? TRAINING_TYPES[0];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      {/* Undo Toast */}
      {undoVisible && (
        <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-zinc-800 border border-white/10 px-4 py-2.5 rounded-xl text-sm text-white shadow-lg">
          <span>{t("training.deleted")}</span>
          <button onClick={handleUndoDelete} className="text-[#10B981] font-semibold hover:text-[#0d9668] transition-colors">
            {t("training.undo")}
          </button>
        </div>
      )}
      {/* ゲストバナー */}
      <div className="bg-gradient-to-r from-violet-600/70 to-indigo-600/60 px-4 py-3 text-center">
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
          <p className="text-zinc-400 text-sm mt-1">
            {t("guest.noLogin")}
          </p>
        </div>

        {/* ゲストステータス */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-zinc-900 rounded-xl p-4 text-center border border-white/10">
            <div className="text-2xl font-bold text-white">{logs.length}</div>
            <div className="text-zinc-400 text-xs mt-1">{t("guest.sessions")}</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 text-center border border-white/10">
            <div className="text-2xl font-bold text-yellow-400">
              {logs.reduce((s, l) => s + l.duration_min, 0)}
            </div>
            <div className="text-zinc-400 text-xs mt-1">{t("guest.totalMins")}</div>
          </div>
        </div>

        {/* 練習記録セクション */}
        <div className="bg-zinc-900 rounded-xl border border-white/10 p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">{t("training.title")}</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className={`text-white text-sm font-bold px-4 py-2.5 min-h-[44px] rounded-lg transition-colors ${showForm ? "bg-zinc-700 hover:bg-zinc-600" : "bg-[#10B981] hover:bg-[#0d9668]"}`}
            >
              {showForm ? t("training.cancel") : t("training.add")}
            </button>
          </div>

          {/* 入力フォーム */}
          {showForm && (
            <div className="space-y-3 mb-4 border border-white/10 rounded-xl p-4 bg-white/5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-zinc-400 text-xs">{t("training.date")}</label>
                  <div className="flex items-center gap-2">
                    {date !== getYesterdayLocalDateString() && (
                      <button
                        type="button"
                        onClick={() => setDate(getYesterdayLocalDateString())}
                        className="text-xs text-zinc-400 hover:text-white font-medium"
                      >
                        {t("training.yesterday")}
                      </button>
                    )}
                    {date !== getLocalDateString() && (
                      <button
                        type="button"
                        onClick={() => setDate(getLocalDateString())}
                        className="text-xs text-emerald-500 hover:text-emerald-300 font-medium"
                      >
                        {t("training.backToToday")}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="date"
                  value={date}
                  max={getLocalDateString()}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-white/30"
                />
              </div>
              {/* 時間プリセット */}
              <div>
                <p className="text-zinc-400 text-xs mb-1.5">{t("training.duration")}</p>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDuration(d)}
                      className={`px-3 py-2 min-h-[36px] rounded-lg text-sm font-medium border transition-colors ${
                        duration === d
                          ? "bg-zinc-600 border-zinc-600 text-white"
                          : "bg-zinc-800 border-white/10 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {d}{t("training.durationUnit")}
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
                      type === t.value ? t.color + " ring-1 ring-white/30" : "bg-zinc-900/50 text-zinc-400 border-white/10 hover:text-zinc-300"
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
                placeholder={t("training.memoOptional")}
                className="w-full bg-zinc-800 text-white text-sm rounded-lg px-3 py-2 border border-white/10 focus:outline-none focus:border-white/30"
              />
              {/* 連続入力チェックボックス */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={continuousInput}
                  onChange={(e) => setContinuousInput(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#10B981] cursor-pointer"
                />
                <span className="text-zinc-400 text-xs">{t("training.continuousInput")}</span>
              </label>
              <button
                onClick={handleAdd}
                disabled={saving}
              className="w-full bg-[#10B981] hover:bg-[#0d9668] active:scale-95 disabled:opacity-60 text-white font-bold py-3 min-h-[44px] rounded-lg text-sm transition-all"
              >
                {t("training.save")}
              </button>
            </div>
          )}

          {/* ログ一覧 */}
          {logs.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <p className="text-4xl mb-2">🥋</p>
              <p className="text-sm">{t("training.empty")}</p>
              <p className="text-xs mt-1">{t("training.emptyDesc")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeInfo(log.type).color}`}>
                      {typeInfo(log.type).label}
                    </span>
                    <span className="text-white text-sm">{log.date}</span>
                    <span className="text-zinc-400 text-xs">{log.duration_min}{t("training.durationUnit")}</span>
                    {log.notes && <span className="text-zinc-400 text-xs truncate">{log.notes}</span>}
                  </div>
                  <button
                    onClick={() => handleDelete(log.id)}
                    className="text-zinc-400 hover:text-red-400 ml-2 flex-shrink-0 text-lg leading-none w-11 h-11 flex items-center justify-center rounded"
                    aria-label={t("training.delete")}
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
            ? "bg-gradient-to-br from-green-500/15 to-violet-600/20 border-green-500/30"
            : "bg-zinc-900 border-white/10"
        }`}>
          {logs.length >= 3 && (
            <p className="text-green-400 text-sm font-semibold mb-1">
              {t("guest.ctaRecorded", { n: logs.length })}
            </p>
          )}
          <p className="text-white font-semibold mb-1">
            {t("guest.ctaTitle")}
          </p>
          <p className="text-zinc-400 text-xs mb-4">
            {t("guest.ctaDesc")}
          </p>
          <Link
            href="/login"
            className="inline-block bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all"
          >
            {t("guest.ctaButton")}
          </Link>
          <p className="text-zinc-400 text-xs mt-2">
            {t("guest.ctaNote")}
          </p>
        </div>
      </main>
    </div>
  );
}

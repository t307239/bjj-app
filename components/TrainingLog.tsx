"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";
import CsvExport from "./CsvExport";
import TrainingLogForm from "./TrainingLogForm";
import TrainingLogList from "./TrainingLogList";
import TrainingLogStats from "./TrainingLogStats";
import {
  type TrainingEntry,
  type CompData,
  getLocalDateString,
  encodeCompNotes,
  decodeCompNotes,
} from "@/lib/trainingLogHelpers";
import { getLocalDateParts } from "@/lib/timezone";

type Props = {
  userId: string;
  isPro?: boolean;
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];
void DURATION_PRESETS; // used by sub-components

// Mini donut chart (monthly type distribution)
function MiniTypeDonut({ entries }: { entries: { type: string }[] }) {
  const TYPE_COLORS_RAW: Record<string, string> = {
    gi: "#3b82f6", nogi: "#f97316", drilling: "#a855f7", competition: "#e94560", open_mat: "#22c55e",
  };
  const counts: Record<string, number> = {};
  entries.forEach((e) => { counts[e.type] = (counts[e.type] ?? 0) + 1; });
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const cx = 20, cy = 20, R = 18, r = 10;
  let cumAngle = -Math.PI / 2;
  const slices = Object.entries(counts).map(([type, count]) => {
    const angle = (count / total) * 2 * Math.PI;
    const start = cumAngle;
    const end = cumAngle + angle;
    cumAngle = end;
    const x1 = cx + R * Math.cos(start), y1 = cy + R * Math.sin(start);
    const x2 = cx + R * Math.cos(end),   y2 = cy + R * Math.sin(end);
    const ix1 = cx + r * Math.cos(end),  iy1 = cy + r * Math.sin(end);
    const ix2 = cx + r * Math.cos(start),iy2 = cy + r * Math.sin(start);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${r} ${r} 0 ${large} 0 ${ix2} ${iy2} Z`;
    return { type, path, color: TYPE_COLORS_RAW[type] ?? "#9ca3af", count };
  });

  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10 flex-shrink-0">
      {slices.map((s) => (
        <g key={s.type}><title>{s.type}: {s.count} sessions</title><path d={s.path} fill={s.color} opacity={0.85} /></g>
      ))}
      <text x={cx} y={cy + 3} textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">
        {total}
      </text>
    </svg>
  );
}

// Stack bar (monthly type distribution ratio)
function MonthTypeStackBar({ entries }: { entries: { type: string }[] }) {
  const TYPE_COLORS: Record<string, string> = {
    gi: "#3b82f6", nogi: "#f97316", drilling: "#a855f7", competition: "#e94560", open_mat: "#22c55e",
  };
  const counts: Record<string, number> = {};
  TRAINING_TYPES.forEach((t) => { counts[t.value] = entries.filter((e) => e.type === t.value).length; });
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return null;

  const segments = TRAINING_TYPES
    .filter((t) => counts[t.value] > 0)
    .map((t) => ({ ...t, count: counts[t.value], percent: (counts[t.value] / total) * 100 }));

  return (
    <div className="w-full h-6 rounded-full flex overflow-hidden gap-0.5 bg-white/5 p-0.5">
      {segments.map((seg) => (
        <div
          key={seg.value}
          className="flex-1 rounded-full transition-all"
          style={{ backgroundColor: TYPE_COLORS[seg.value], width: `${seg.percent}%`, minWidth: seg.percent > 10 ? "auto" : "2px" }}
          title={`${seg.label}: ${seg.count} sessions (${seg.percent.toFixed(0)}%)`}
        />
      ))}
    </div>
  );
}

export default function TrainingLog({ userId, isPro = false }: Props) {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [techniqueSuggestions, setTechniqueSuggestions] = useState<string[]>([]);
  const INITIAL_SIZE = 3;
  const PAGE_SIZE = 10;
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "month" | "week">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; duration?: number; onUndo?: () => void } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; entry: TrainingEntry; timerId: ReturnType<typeof setTimeout> } | null>(null);
  const today = getLocalDateString();
  const [form, setForm] = useState({
    date: getLocalDateString(),
    duration_min: 60,
    type: "gi",
    notes: "",
  });

  // #72: detect ?addLog=YYYY-MM-DD from calendar empty-day click
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const addLogDate = params.get("addLog");
    if (addLogDate && /^\d{4}-\d{2}-\d{2}$/.test(addLogDate)) {
      setForm((f) => ({ ...f, date: addLogDate }));
      setShowForm(true);
      // Remove the param from the URL without navigating
      const url = new URL(window.location.href);
      url.searchParams.delete("addLog");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  const [editForm, setEditForm] = useState({
    date: "",
    duration_min: 60,
    type: "gi",
    notes: "",
  });
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [trainedToday, setTrainedToday] = useState<boolean | null>(null);
  const [compForm, setCompForm] = useState<CompData>({
    result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi",
  });
  const [editCompForm, setEditCompForm] = useState<CompData>({
    result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi",
  });
  const supabase = createClient();
  const router = useRouter();
  const { t } = useLocale();
  // Idempotency key: client-generated UUID sent as row id to prevent duplicate INSERTs
  // on network retry. Reset after each successful/failed submit.
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  );

  // Initial data load
  useEffect(() => {
    const loadEntries = async () => {
      setInitialLoading(true);
      const [{ data, error }, { data: techData }, { count }] = await Promise.all([
        supabase
          .from("training_logs")
          .select("*")
          .eq("user_id", userId)
          .order("date", { ascending: false })
          .limit(INITIAL_SIZE + 1),
        // Phase 2.5: fetch technique names for autocomplete suggestions
        supabase
          .from("technique_nodes")
          .select("label")
          .eq("user_id", userId)
          .order("label", { ascending: true }),
        // #138: total session count for header badge
        supabase
          .from("training_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      if (!error && data) {
        setHasMore(data.length > INITIAL_SIZE);
        const slice = data.slice(0, INITIAL_SIZE);
        setEntries(slice);
        setTrainedToday(slice.some((e: TrainingEntry) => e.date === getLocalDateString()));
      } else {
        setTrainedToday(false);
      }
      if (techData) {
        const names = [...new Set(techData.map((t: { label: string }) => t.label).filter(Boolean))];
        setTechniqueSuggestions(names);
      }
      if (count !== null) setTotalCount(count);
      setInitialLoading(false);
    };

    loadEntries();

    // Restore pending form data after session-expiry login redirect
    try {
      const pending = localStorage.getItem("pending_training_log");
      if (pending) {
        const saved = JSON.parse(pending) as typeof form;
        if (saved && typeof saved === "object") {
          setForm((prev) => ({ ...prev, ...saved }));
          setShowForm(true);
          localStorage.removeItem("pending_training_log");
          setToast({ message: "Your unsaved session was restored. Please save it.", type: "success" });
        }
      }
    } catch { /* ignore */ }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.date > today) {
      setFormError(t("training.futureDate"));
      return;
    }
    if (form.duration_min < 1 || form.duration_min > 480) {
      setFormError(t("training.durationRange"));
      return;
    }

    const finalNotes = form.type === "competition"
      ? encodeCompNotes(compForm, form.notes)
      : form.notes;

    // Optimistic UI
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticEntry: TrainingEntry = {
      id: optimisticId,
      date: form.date,
      duration_min: form.duration_min,
      type: form.type,
      notes: finalNotes,
      created_at: new Date().toISOString(),
    };
    setEntries((prev) => [optimisticEntry, ...prev]);
    setTrainedToday(true);
    setShowForm(false);
    setForm({ date: getLocalDateString(), duration_min: 60, type: "gi", notes: "" });
    setCompForm({ result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi" });

    setLoading(true);
    const { data, error } = await supabase
      .from("training_logs")
      .insert([{ id: idempotencyKey.current, ...form, notes: finalNotes, user_id: userId }])
      .select()
      .single();

    if (!error && data) {
      if (typeof navigator !== "undefined") navigator.vibrate?.([50]);
      setEntries((prev) => prev.map((e) => e.id === optimisticId ? data : e));
      setTotalCount((c) => (c !== null ? c + 1 : null));
      setToast({ message: t("training.saved"), type: "success" });
      // Rotate idempotency key for next submission
      idempotencyKey.current = typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticId));
      setShowForm(true);
      // Detect auth expiry (ITP/Safari session loss) — redirect with form data preserved
      const isAuthError = error?.code === "401"
        || error?.message?.toLowerCase().includes("jwt")
        || error?.message?.toLowerCase().includes("unauthorized");
      if (isAuthError) {
        try { localStorage.setItem("pending_training_log", JSON.stringify({ ...form, notes: finalNotes })); } catch { /* ignore */ }
        router.push("/login?reason=session_expired");
      } else {
        setToast({ message: t("training.saveFailed"), type: "error" });
      }
      // Reset key so retry uses a fresh UUID
      idempotencyKey.current = typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    }
    setLoading(false);
  };

  const handleDelete = (id: string) => {
    const removed = entries.find((e) => e.id === id);
    if (!removed) return;

    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
    }

    setEntries((prev) => prev.filter((e) => e.id !== id));

    const timerId = setTimeout(async () => {
      setPendingDelete(null);
      setDeletingId(id);
      const { error } = await supabase
        .from("training_logs")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (!error) {
        if (typeof navigator !== "undefined") navigator.vibrate?.([30, 20, 30]);
        setTotalCount((c) => (c !== null ? Math.max(0, c - 1) : null));
      } else {
        setEntries((prev) => [removed, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        setToast({ message: t("training.deleteFailed"), type: "error" });
      }
      setDeletingId(null);
    }, 5000);

    setPendingDelete({ id, entry: removed, timerId });

    setToast({
      message: t("training.deletedUndo"),
      type: "success",
      duration: 5000,
      onUndo: () => {
        clearTimeout(timerId);
        setPendingDelete(null);
        setEntries((prev) => [removed, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        setToast(null);
      },
    });
  };

  const startEdit = (entry: TrainingEntry) => {
    setEditingId(entry.id);
    setEditForm({
      date: entry.date,
      duration_min: entry.duration_min,
      type: entry.type,
      notes: entry.notes,
    });
    if (entry.type === "competition") {
      const { comp } = decodeCompNotes(entry.notes);
      if (comp) setEditCompForm(comp);
      else setEditCompForm({ result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi" });
    }
  };

  const handleUpdate = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const finalEditNotes = editForm.type === "competition"
      ? encodeCompNotes(editCompForm, editForm.notes)
      : editForm.notes;

    const { data, error } = await supabase
      .from("training_logs")
      .update({ ...editForm, notes: finalEditNotes })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (!error && data) {
      setEntries((prev) => prev.map((e) => (e.id === id ? data : e)));
      setEditingId(null);
      setToast({ message: t("training.updated"), type: "success" });
    } else {
      setToast({ message: t("training.updateFailed"), type: "error" });
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const { data, error } = await supabase
      .from("training_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .range(entries.length, entries.length + PAGE_SIZE);

    if (!error && data) {
      setHasMore(data.length > PAGE_SIZE);
      setEntries([...entries, ...data.slice(0, PAGE_SIZE)]);
    }
    setLoadingMore(false);
  };

  // Period filter calculation
  const getPeriodStart = (): string | null => {
    if (periodFilter === "all") return null;
    const now = new Date();
    if (periodFilter === "month") {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  };
  const periodStart = getPeriodStart();

  // Type filter + period filter + keyword search
  const filtered = entries
    .filter((e) => filterType === "all" || e.type === filterType)
    .filter((e) => !periodStart || e.date >= periodStart)
    .filter((e) => !dateFrom || e.date >= dateFrom)
    .filter((e) => !dateTo || e.date <= dateTo)
    .filter((e) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const { userNotes } = decodeCompNotes(e.notes);
      const typeLabel = TRAINING_TYPES.find((t) => t.value === e.type)?.label ?? e.type;
      return (
        e.date.includes(q) ||
        typeLabel.toLowerCase().includes(q) ||
        userNotes.toLowerCase().includes(q)
      );
    });

  // This month stats (used for Bento section below)
  const thisMonth = getLocalDateString().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const monthTotalMins = monthEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const monthHoursDisplay = monthTotalMins >= 60
    ? `${Math.floor(monthTotalMins / 60)}h${monthTotalMins % 60 > 0 ? `${monthTotalMins % 60}m` : ""}`
    : `${monthTotalMins}m`;

  const { day: curDayLog, month: curMonthLog, year: curYearLog, daysInMonth: daysInMonthLog } = getLocalDateParts();
  const monthProjected = curDayLog > 0 ? Math.round(monthEntries.length / curDayLog * daysInMonthLog) : 0;
  const remainingDaysLog = daysInMonthLog - curDayLog;
  const prevM = curMonthLog === 1 ? 12 : curMonthLog - 1;
  const prevY = curMonthLog === 1 ? curYearLog - 1 : curYearLog;
  const prevMonthYM = `${prevY}-${String(prevM).padStart(2, "0")}`;
  const lastMonthSamePeriod = entries.filter((e) => {
    if (!e.date.startsWith(prevMonthYM)) return false;
    const day = parseInt(e.date.slice(8, 10), 10);
    return day <= curDayLog;
  }).length;
  const monthDelta = monthEntries.length - lastMonthSamePeriod;

  // Suppress unused-var TS warnings for stats used in Bento/Analytics (kept for future use)
  void monthHoursDisplay;
  void monthProjected;
  void remainingDaysLog;
  void monthDelta;

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      )}

      {/* Today's training prompt */}
      {!initialLoading && trainedToday === false && (
        <div
          className="bg-[#e94560]/10 border border-[#e94560]/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3 cursor-pointer hover:bg-[#e94560]/15 transition-colors"
          onClick={() => setShowForm(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setShowForm(true)}
        >
          <span className="text-xl flex-shrink-0">🥋</span>
          <div className="flex-1 min-w-0">
            <p className="text-[#e94560] text-sm font-medium">Log today&apos;s session!</p>
            <p className="text-gray-400 text-xs mt-0.5">Tap to add training log</p>
          </div>
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Stats (weekly summary) */}
      <TrainingLogStats entries={entries} hasMore={hasMore} />

      {/* Monthly Bento Grid section */}
      {!initialLoading && monthEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-zinc-900 rounded-xl p-3 border border-white/10 flex items-center gap-3">
            <MiniTypeDonut entries={monthEntries} />
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">This Month</p>
              <p className="text-lg font-bold text-white">{monthEntries.length}</p>
              <p className="text-[11px] text-gray-400">sessions</p>
            </div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 border border-white/10">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">Type Mix</p>
            <MonthTypeStackBar entries={monthEntries} />
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
              {TRAINING_TYPES.filter((t) => monthEntries.some((e) => e.type === t.value)).map((t) => (
                <span key={t.value} className="text-[9px] text-gray-500">
                  {t.icon} {t.label}: {monthEntries.filter((e) => e.type === t.value).length}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">
            Training Log
            {totalCount !== null && totalCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">({totalCount})</span>
            )}
          </h3>
          <CsvExport userId={userId} isPro={isPro} />
          <button
            onClick={() => window.print()}
            title="Print / Save as PDF"
            className="print:hidden flex items-center gap-1 text-[11px] text-gray-400 hover:text-zinc-100 bg-zinc-900 border border-white/10 hover:border-white/10 px-2 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="print:hidden bg-[#e94560] hover:bg-[#c73652] active:scale-95 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
        >
          + Add Session
        </button>
      </div>

      {/* Add session form */}
      <TrainingLogForm
        showForm={showForm}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        loading={loading}
        formError={formError}
        today={today}
        onClose={() => { setShowForm(false); setFormError(null); }}
        compForm={compForm}
        setCompForm={setCompForm}
        techniqueSuggestions={techniqueSuggestions}
      />

      {/* Keyword search */}
      {!initialLoading && entries.length > 0 && (
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by date, type, notes..."
            className="w-full bg-zinc-800 text-white rounded-xl pl-9 pr-9 py-2 text-sm border border-white/20 focus:outline-none focus:border-[#e94560]/60 placeholder-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Period filter */}
      {!initialLoading && entries.length > 0 && (
        <div className="flex gap-1.5 mb-2">
          {(["all", "month", "week"] as const).map((p) => {
            const label = p === "all" ? "All Time" : p === "month" ? "This Month" : "This Week";
            return (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  periodFilter === p
                    ? "bg-[#e94560] text-white"
                    : "bg-zinc-900 text-gray-400 border border-white/10"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Date range filter */}
      {!initialLoading && entries.length > 0 && (dateFrom || dateTo) ? (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="date"
            value={dateFrom}
            max={dateTo || today}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 bg-zinc-900 text-white text-xs rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none focus:border-[#e94560]/60"
          />
          <span className="text-gray-600 text-xs">–</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 bg-zinc-900 text-white text-xs rounded-lg px-2 py-1.5 border border-white/10 focus:outline-none focus:border-[#e94560]/60"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-gray-500 hover:text-white text-xs px-2">
              ✕
            </button>
          )}
        </div>
      ) : null}

      {/* Date range button (when not set) */}
      {!initialLoading && entries.length > 0 && !dateFrom && !dateTo && (
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors text-gray-600 border border-white/10 hover:border-white/10 hover:text-gray-400"
          >
            📅 Filter by Date
          </button>
        </div>
      )}

      {/* Type filter */}
      {!initialLoading && entries.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setFilterType("all")}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterType === "all"
                ? "bg-[#e94560] text-white"
                : "bg-zinc-900 text-gray-400 border border-white/10"
            }`}
          >
            {t("training.all")}
          </button>
          {TRAINING_TYPES.filter((t) =>
            entries.some((e) => e.type === t.value)
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => setFilterType(t.value)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterType === t.value
                  ? "bg-[#e94560] text-white"
                  : "bg-zinc-900 text-gray-400 border border-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Entry list */}
      <TrainingLogList
        initialLoading={initialLoading}
        entries={entries}
        filtered={filtered}
        searchQuery={searchQuery}
        editingId={editingId}
        editForm={editForm}
        setEditForm={setEditForm}
        onStartEdit={startEdit}
        onCancelEdit={() => setEditingId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        deletingId={deletingId}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={handleLoadMore}
        expandedNotes={expandedNotes}
        setExpandedNotes={setExpandedNotes}
        editCompForm={editCompForm}
        setEditCompForm={setEditCompForm}
        today={today}
        onShowForm={() => setShowForm(true)}
      />

      {/* FAB: Mobile only */}
      <button
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50]);
          setShowForm(true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-[#e94560] hover:bg-[#c73652] active:scale-95 text-white text-2xl font-bold rounded-full shadow-lg shadow-[#e94560]/40 transition-all flex items-center justify-center print:hidden"
        aria-label="Log training session"
      >
        +
      </button>
    </div>
  );
}

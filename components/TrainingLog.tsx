"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import Toast from "./Toast";
import CsvExport from "./CsvExport";

type TrainingEntry = {
  id: string;
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  created_at: string;
};

type Props = {
  userId: string;
  isPro?: boolean;
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];

// JST helper: toISOString() is UTC, so return local date
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
          className={`flex-1 rounded-full transition-all`}
          style={{ backgroundColor: TYPE_COLORS[seg.value], width: `${seg.percent}%`, minWidth: seg.percent > 10 ? "auto" : "2px" }}
          title={`${seg.label}: ${seg.count} sessions (${seg.percent.toFixed(0)}%)`}
        />
      ))}
    </div>
  );
}

function getLocalDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

// Encode competition details (no redefine needed)
type CompData = { result: string; opponent: string; finish: string; event: string; opponent_rank: string; gi_type: string; };
const COMP_PREFIX = "__comp__";

const BELT_RANKS = [
  { value: "", label: "Unknown" },
  { value: "white", label: "White Belt" },
  { value: "blue", label: "Blue Belt" },
  { value: "purple", label: "Purple Belt" },
  { value: "brown", label: "Brown Belt" },
  { value: "black", label: "Black Belt" },
];

function encodeCompNotes(comp: CompData, userNotes: string): string {
  const filled = Object.values(comp).some((v) => v.trim() !== "");
  if (!filled) return userNotes;
  const jsonStr = JSON.stringify(comp);
  return userNotes.trim() ? `${COMP_PREFIX}${jsonStr}\n${userNotes}` : `${COMP_PREFIX}${jsonStr}`;
}

function decodeCompNotes(notes: string): { comp: CompData | null; userNotes: string } {
  if (!notes || !notes.startsWith(COMP_PREFIX)) return { comp: null, userNotes: notes };
  const nl = notes.indexOf("\n");
  const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
  const userNotes = nl === -1 ? "" : notes.slice(nl + 1);
  try {
    return { comp: JSON.parse(jsonStr) as CompData, userNotes };
  } catch {
    return { comp: null, userNotes: notes };
  }
}

const RESULT_LABELS: Record<string, { label: string; color: string }> = {
  win:  { label: "Win 🏆", color: "text-green-400" },
  loss: { label: "Loss", color: "text-red-400" },
  draw: { label: "Draw", color: "text-yellow-400" },
};

function buildXShareUrl(entry: { date: string; duration_min: number; type: string; notes: string }): string {
  const typeLabels: Record<string, string> = {
    gi: "Gi", nogi: "No-Gi", drilling: "Drilling", competition: "Competition", open_mat: "Open Mat",
  };
  const dur = entry.duration_min >= 60
    ? `${Math.floor(entry.duration_min / 60)}h${entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}m` : ""}`
    : `${entry.duration_min}m`;
  const lines = [
    `🥋 Just trained BJJ! (${entry.date})`,
    `⏱ ${dur} | ${typeLabels[entry.type] ?? entry.type}`,
    entry.notes ? `📝 ${entry.notes}` : "",
    "",
    "Training Log → https://bjj-app.net",
    "#BJJ #JiuJitsu #BrazilianJiuJitsu",
  ].filter(Boolean).join("\n");
  return `https://x.com/intent/tweet?text=${encodeURIComponent(lines)}`;
}

function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const isPreset = DURATION_PRESETS.includes(value);
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">Duration</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DURATION_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              value === d
                ? "bg-[#e94560] text-white"
                : "bg-zinc-800 text-gray-400 hover:text-white"
            }`}
          >
            {formatDuration(d)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={1}
          max={480}
          step={1}
          className={`w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-[#7c3aed] ${
            isPreset ? "border-white/10" : "border-[#e94560]"
          }`}
        />
        <span className="text-gray-500 text-xs flex-shrink-0">min</span>
      </div>
    </div>
  );
}

export default function TrainingLog({ userId, isPro = false }: Props) {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const INITIAL_SIZE = 3;
  const PAGE_SIZE = 10;
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "month" | "week">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const today = getLocalDateString();
  const [form, setForm] = useState({
    date: getLocalDateString(),
    duration_min: 60,
    type: "gi",
    notes: "",
  });
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

  // Initial data load
  useEffect(() => {
    const loadEntries = async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("training_logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(INITIAL_SIZE + 1);

      if (!error && data) {
        setHasMore(data.length > INITIAL_SIZE);
        const slice = data.slice(0, INITIAL_SIZE);
        setEntries(slice);
        setTrainedToday(slice.some((e: TrainingEntry) => e.date === getLocalDateString()));
      } else {
        setTrainedToday(false);
      }
      setInitialLoading(false);
    };

    loadEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // バリデーション
    if (form.date > today) {
      setFormError("Cannot record future dates");
      return;
    }
    if (form.duration_min < 1 || form.duration_min > 480) {
      setFormError("Duration must be between 1-480 minutes");
      return;
    }

    setLoading(true);

    // Encode competition details into notes
    const finalNotes = form.type === "competition"
      ? encodeCompNotes(compForm, form.notes)
      : form.notes;

    const { data, error } = await supabase
      .from("training_logs")
      .insert([{ ...form, notes: finalNotes, user_id: userId }])
      .select()
      .single();

    if (!error && data) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50]);
      setEntries([data, ...entries]);
      setForm({
        date: getLocalDateString(),
        duration_min: 60,
        type: "gi",
        notes: "",
      });
      setCompForm({ result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi" });
      setShowForm(false);
      setToast({ message: "Session recorded!", type: "success" });
    } else {
      setToast({ message: "Failed to save", type: "error" });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this record?")) return;
    setDeletingId(id);

    const { error } = await supabase
      .from("training_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([30, 20, 30]);
      setEntries(entries.filter((e) => e.id !== id));
      setToast({ message: "Record deleted", type: "success" });
    } else {
      setToast({ message: "Failed to delete", type: "error" });
    }
    setDeletingId(null);
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
      setEntries(entries.map((e) => (e.id === id ? data : e)));
      setEditingId(null);
      setToast({ message: "Record updated", type: "success" });
    } else {
      setToast({ message: "Failed to update", type: "error" });
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    const { data, error } = await supabase
      .from("training_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .range(entries.length, entries.length + PAGE_SIZE); // inclusive, fetches PAGE_SIZE+1 rows

    if (!error && data) {
      // range(n, n+PAGE_SIZE) fetches PAGE_SIZE+1 rows
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
    // week: this week Monday
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

  // This month's total duration
  const thisMonth = getLocalDateString().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const monthTotalMins = monthEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const monthHoursDisplay = monthTotalMins >= 60
    ? `${Math.floor(monthTotalMins / 60)}h${monthTotalMins % 60 > 0 ? `${monthTotalMins % 60}m` : ""}`
    : `${monthTotalMins}m`;

  // Month-end projection + month-over-month comparison (JST)
  const jstNowLog = new Date(Date.now() + 9 * 3600000);
  const curDayLog = jstNowLog.getUTCDate();
  const daysInMonthLog = new Date(jstNowLog.getUTCFullYear(), jstNowLog.getUTCMonth() + 1, 0).getUTCDate();
  const monthProjected = curDayLog > 0 ? Math.round(monthEntries.length / curDayLog * daysInMonthLog) : 0;
  const remainingDaysLog = daysInMonthLog - curDayLog;
  // Previous month comparison: calculate last month YYYY-MM and count sessions up to same date
  const prevMonthDate = new Date(jstNowLog.getUTCFullYear(), jstNowLog.getUTCMonth() - 1, 1);
  const prevMonthYM = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthSamePeriod = entries.filter((e) => {
    if (!e.date.startsWith(prevMonthYM)) return false;
    const day = parseInt(e.date.slice(8, 10), 10);
    return day <= curDayLog;
  }).length;
  const monthDelta = monthEntries.length - lastMonthSamePeriod;

  // This week summary (Monday start)
  const nowForWeek = new Date();
  const dowForWeek = nowForWeek.getDay(); // 0=Sun
  const daysToMon = dowForWeek === 0 ? 6 : dowForWeek - 1;
  const mondayDate = new Date(nowForWeek);
  mondayDate.setDate(nowForWeek.getDate() - daysToMon);
  const thisWeekStart = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, "0")}-${String(mondayDate.getDate()).padStart(2, "0")}`;
  const weekEntries = entries.filter((e) => e.date >= thisWeekStart);
  const weekTotalMins = weekEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const weekHoursDisplay = weekTotalMins >= 60
    ? `${Math.floor(weekTotalMins / 60)}h${weekTotalMins % 60 > 0 ? `${weekTotalMins % 60}m` : ""}`
    : `${weekTotalMins}m`;

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
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
            <p className="text-[#e94560] text-sm font-medium">Log today's session!</p>
            <p className="text-gray-400 text-xs mt-0.5">Tap to add training log</p>
          </div>
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Weekly and monthly summary */}
      {!initialLoading && entries.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4">
          {/* This week summary row */}
          {weekEntries.length > 0 && (
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/10">
              <span className="text-[10px] font-semibold text-yellow-400/80 uppercase tracking-wide flex-shrink-0">This Week</span>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-yellow-400">{weekEntries.length}</span>
                  <span className="text-[10px] text-gray-500">sessions</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-yellow-400/80">{weekHoursDisplay}</span>
                  <span className="text-[10px] text-gray-500">total</span>
                </div>
                {weekEntries.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">
                        {formatDuration(Math.round(weekTotalMins / weekEntries.length))}/session
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* Monthly summary displayed in Bento Grid */}
          {/* Type stack bar moved to Analytics section */}
          {/* Monthly type distribution and projection shown in Bento Grid + Analytics section */}
          {hasMore && (
            <p className="text-gray-600 text-xs text-center mt-2">※ More data available. Click "Load More" to update</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Training Log</h3>
          <CsvExport userId={userId} isPro={isPro} />
          {/* Print button */}
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
            className="w-full bg-zinc-900 text-white rounded-xl pl-9 pr-9 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#e94560]/60 placeholder-gray-600"
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
          <span className="text-gray-600 text-xs">〜</span>
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

      {/* Date range buttons (when not set) */}
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

      {/* タイプフィルター */}
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
            すべて
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

      {/* Entry form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4"
        >
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
              {formError}
            </div>
          )}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 text-xs">Date</label>
              {form.date !== today && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, date: today })}
                  className="text-[10px] text-[#e94560] hover:text-[#c73652] font-medium"
                >
                  Back to Today
                </button>
              )}
            </div>
            <input
              type="date"
              value={form.date}
              max={today}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
              required
            />
          </div>
          <div className="mb-3">
            <DurationPicker
              value={form.duration_min}
              onChange={(v) => setForm({ ...form, duration_min: v })}
            />
          </div>

          <div className="mb-3">
            <label className="block text-gray-400 text-xs mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed]"
            >
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Competition details form (only shown when competition type selected) */}
          {form.type === "competition" && (
            <div className="mb-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-red-400 font-semibold mb-2">🏆 Competition Record</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Result</label>
                  <select
                    value={compForm.result}
                    onChange={(e) => setCompForm({ ...compForm, result: e.target.value })}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-red-400"
                  >
                    <option value="win">Win 🏆</option>
                    <option value="loss">Loss</option>
                    <option value="draw">Draw</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Opponent (optional)</label>
                  <input
                    type="text"
                    value={compForm.opponent}
                    onChange={(e) => setCompForm({ ...compForm, opponent: e.target.value })}
                    placeholder="Opponent's name"
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Finish (optional)</label>
                  <input
                    type="text"
                    value={compForm.finish}
                    onChange={(e) => setCompForm({ ...compForm, finish: e.target.value })}
                    placeholder="E.g.: Heel Hook"
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Event (optional)</label>
                  <input
                    type="text"
                    value={compForm.event}
                    onChange={(e) => setCompForm({ ...compForm, event: e.target.value })}
                    placeholder="E.g.: Tokyo Open"
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Opponent Belt (optional)</label>
                  <select
                    value={compForm.opponent_rank}
                    onChange={(e) => setCompForm({ ...compForm, opponent_rank: e.target.value })}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-red-400"
                  >
                    {BELT_RANKS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Gi Type</label>
                  <select
                    value={compForm.gi_type}
                    onChange={(e) => setCompForm({ ...compForm, gi_type: e.target.value })}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-red-400"
                  >
                    <option value="gi">Gi</option>
                    <option value="nogi">ノーギ (NoGi)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1">メモ</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Key insights, tips, what you learned..."
              rows={2}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#e94560] hover:bg-[#c73652] active:scale-95 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-all"
            >
              {loading ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null); }}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* ローディング */}
      {initialLoading && (
        <div className="text-center py-8 text-gray-500">
          <div className="inline-block w-6 h-6 border-2 border-white/10 border-t-[#e94560] rounded-full animate-spin mb-2" />
          <p className="text-sm">Loading...</p>
        </div>
      )}

      {/* Log list / Empty State */}
      {!initialLoading && entries.length === 0 && (
        <div className="text-center py-12 px-4">
          <div className="text-6xl mb-4 animate-bounce inline-block">🥋</div>
          <p className="text-white font-bold text-lg mb-1">No training logs yet</p>
          <p className="text-gray-400 text-sm mb-2">Start your growth journey by logging your first session!</p>
          <div className="flex justify-center gap-4 text-xs text-gray-600 mb-6">
            <span>✓ Free to use</span>
            <span>✓ Cloud synced</span>
            <span>✓ Track progress</span>
          </div>
          <button
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50]);
              setShowForm(true);
            }}
            className="bg-[#e94560] hover:bg-[#c73652] active:scale-95 text-white text-sm font-bold py-3 px-8 rounded-full transition-all shadow-lg shadow-[#e94560]/30 animate-pulse hover:animate-none"
          >
            + Log First Session
          </button>
        </div>
      )}

      {!initialLoading && entries.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery ? `No records match "${searchQuery}"` : "No records match this filter"}
        </div>
      )}

      {!initialLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`bg-zinc-900/50 backdrop-blur-sm rounded-2xl p-4 border border-white/10 hover:bg-white/[0.04] transition-colors duration-150${entry.type === "competition" ? " border-l-2 border-l-red-500" : ""}`}
            >
              {editingId === entry.id ? (
                /* Inline edit form */
                <form onSubmit={(e) => handleUpdate(e, entry.id)}>
                  <div className="mb-2">
                    <input
                      type="date"
                      value={editForm.date}
                      max={today}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] mb-2"
                    />
                    <DurationPicker
                      value={editForm.duration_min}
                      onChange={(v) => setEditForm({ ...editForm, duration_min: v })}
                    />
                  </div>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] mb-2"
                  >
                    {TRAINING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {editForm.type === "competition" && (
                    <div className="mb-2 bg-red-500/5 border border-red-500/20 rounded-xl p-2 space-y-1.5">
                      <p className="text-[10px] text-red-400 font-semibold">🏆 Competition Details</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={editCompForm.result}
                          onChange={(e) => setEditCompForm({ ...editCompForm, result: e.target.value })}
                          className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400"
                        >
                          <option value="win">Win 🏆</option>
                          <option value="loss">Loss</option>
                          <option value="draw">Draw</option>
                        </select>
                        <input
                          type="text"
                          value={editCompForm.opponent}
                          onChange={(e) => setEditCompForm({ ...editCompForm, opponent: e.target.value })}
                          placeholder="Opponent"
                          className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={editCompForm.finish}
                          onChange={(e) => setEditCompForm({ ...editCompForm, finish: e.target.value })}
                          placeholder="Finish technique"
                          className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-600"
                        />
                        <input
                          type="text"
                          value={editCompForm.event}
                          onChange={(e) => setEditCompForm({ ...editCompForm, event: e.target.value })}
                          placeholder="Event name"
                          className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400 placeholder-gray-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={editCompForm.opponent_rank}
                          onChange={(e) => setEditCompForm({ ...editCompForm, opponent_rank: e.target.value })}
                          className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400"
                        >
                          {BELT_RANKS.map((b) => (
                            <option key={b.value} value={b.value}>{b.label}</option>
                          ))}
                        </select>
                        <select
                          value={editCompForm.gi_type}
                          onChange={(e) => setEditCompForm({ ...editCompForm, gi_type: e.target.value })}
                          className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1 text-xs border border-white/10 focus:outline-none focus:border-red-400"
                        >
                          <option value="gi">Gi</option>
                          <option value="nogi">ノーギ</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-[#7c3aed] resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[#e94560] text-white text-xs font-semibold py-1.5 rounded-lg">
                      Update
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 text-gray-400 text-xs">
                      キャンセル
                    </button>
                  </div>
                </form>
              ) : (
                /* Normal display */
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${TRAINING_TYPES.find((t) => t.value === entry.type)?.color || "bg-white/10 text-gray-300"}`}>
                        <span>{TRAINING_TYPES.find((t) => t.value === entry.type)?.icon || "🥋"}</span>
                        <span>{TRAINING_TYPES.find((t) => t.value === entry.type)?.label || entry.type}</span>
                      </span>
                      <span className="text-gray-400 text-xs">{entry.date}</span>
                    </div>
                    <div className="text-[#e94560] text-xs font-medium mb-1">
                      ⏱ {entry.duration_min >= 60
                        ? `${Math.floor(entry.duration_min / 60)}h${entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}m` : ""}`
                        : `${entry.duration_min}m`}
                    </div>
                    {entry.notes && (() => {
                      const { comp, userNotes } = decodeCompNotes(entry.notes);
                      return (
                        <>
                          {comp && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              <span className={`text-xs font-semibold ${RESULT_LABELS[comp.result]?.color ?? "text-gray-400"}`}>
                                {RESULT_LABELS[comp.result]?.label ?? comp.result}
                              </span>
                              {comp.gi_type && (
                                <span className={`text-xs px-1.5 py-0.5 rounded ${comp.gi_type === "nogi" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"}`}>
                                  {comp.gi_type === "nogi" ? "NoGi" : "Gi"}
                                </span>
                              )}
                              {comp.opponent && (
                                <span className="text-xs text-gray-400">
                                  vs {comp.opponent}
                                  {comp.opponent_rank && <span className="ml-1 text-gray-500">({BELT_RANKS.find((b) => b.value === comp.opponent_rank)?.label ?? comp.opponent_rank})</span>}
                                </span>
                              )}
                              {comp.finish && <span className="text-xs text-gray-500">by {comp.finish}</span>}
                              {comp.event && <span className="text-xs text-gray-500">🏟 {comp.event}</span>}
                            </div>
                          )}
                          {userNotes && (
                            expandedNotes.has(entry.id) || userNotes.length <= 80 ? (
                              <div>
                                <p className="text-gray-300 text-sm mt-1">{userNotes}</p>
                                {userNotes.length > 80 && (
                                  <button
                                    onClick={() => setExpandedNotes((prev) => { const s = new Set(prev); s.delete(entry.id); return s; })}
                                    className="text-[11px] text-gray-600 hover:text-gray-400 mt-0.5"
                                  >
                                    Collapse ▲
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="text-gray-300 text-sm mt-1">{userNotes.slice(0, 80)}…</p>
                                <button
                                  onClick={() => setExpandedNotes((prev) => new Set([...prev, entry.id]))}
                                  className="text-[11px] text-gray-600 hover:text-gray-400 mt-0.5"
                                >
                                  Show More ▼
                                </button>
                              </div>
                            )
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex gap-1 ml-3 flex-shrink-0">
                    <a
                      href={buildXShareUrl(entry)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-600 hover:text-sky-400 transition-colors p-1"
                      title="Xでシェア"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                    </a>
                    <button
                      onClick={() => startEdit(entry)}
                      className="text-gray-600 hover:text-blue-400 transition-colors p-1"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === entry.id ? (
                        <span className="text-xs">...</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Load more button */}
      {!initialLoading && hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-gray-400 hover:text-white text-sm border border-white/10 hover:border-white/10 px-6 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {/* FAB: Mobile only fixed display */}
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

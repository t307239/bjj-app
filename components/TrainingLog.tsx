"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";
import CsvExport from "./CsvExport";
import TrainingLogForm from "./TrainingLogForm";
import TrainingLogList from "./TrainingLogList";
import TrainingLogStats from "./TrainingLogStats";
import FirstRollCelebration from "./FirstRollCelebration";
import {
  type TrainingEntry,
  type CompData,
  getLocalDateString,
  encodeCompNotes,
  decodeCompNotes,
  encodeRollNotes,
} from "@/lib/trainingLogHelpers";
import { getLocalDateParts } from "@/lib/timezone";

type Props = {
  userId: string;
  isPro?: boolean;
  /** B-05: Auto-open log form for new users (set by dashboard when ?welcome=1 and no logs exist) */
  initialOpen?: boolean;
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

// ── Item 2: Export dropdown — replaces the secondary row of 3 loose buttons ──
function ExportDropdown({ userId, isPro, onPdf, pdfLoading }: {
  userId: string; isPro: boolean; onPdf: () => void; pdfLoading: boolean;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingTech, setLoadingTech] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const COMP_PREFIX = "__comp__";
  type CompData = { result: string; opponent: string; finish: string; event: string };
  function decodeNotes(notes: string): { comp: CompData | null; userNotes: string } {
    if (!notes || !notes.startsWith(COMP_PREFIX)) return { comp: null, userNotes: notes };
    const nl = notes.indexOf("\n");
    const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
    try { return { comp: JSON.parse(jsonStr) as CompData, userNotes: nl === -1 ? "" : notes.slice(nl + 1) }; }
    catch { return { comp: null, userNotes: notes }; }
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const exportTraining = async () => {
    setLoadingLogs(true); setOpen(false);
    try {
      const { data: logs } = await supabase
        .from("training_logs").select("date,type,duration_min,notes").eq("user_id", userId).order("date", { ascending: false });
      if (!logs) return;
      const headers = ["Date","Type","Duration(min)","Result","Opponent","Finish","Event","Notes"];
      const rows = (logs as { date: string; type: string; duration_min: number; notes: string }[]).map((l) => {
        const { comp, userNotes } = decodeNotes(l.notes ?? "");
        return [l.date, l.type, l.duration_min ?? "", comp?.result ?? "", comp?.opponent ?? "", comp?.finish ?? "", comp?.event ?? "", (userNotes ?? "").replace(/"/g, '""')];
      });
      downloadCsv([headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n"),
        `bjj_training_${new Date().toISOString().slice(0,10)}.csv`);
    } finally { setLoadingLogs(false); }
  };

  const exportTechniques = async () => {
    setLoadingTech(true); setOpen(false);
    try {
      const { data: techs } = await supabase
        .from("techniques").select("name,category,mastery_level,notes").eq("user_id", userId).order("name");
      if (!techs) return;
      const headers = ["Technique","Category","Mastery","Notes"];
      const rows = (techs as { name: string; category: string; mastery_level: number; notes: string }[]).map((t) =>
        [t.name ?? "", t.category ?? "", t.mastery_level ?? "", (t.notes ?? "").replace(/"/g, '""')]);
      downloadCsv([headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n"),
        `bjj_techniques_${new Date().toISOString().slice(0,10)}.csv`);
    } finally { setLoadingTech(false); }
  };

  const isAnyLoading = loadingLogs || loadingTech || pdfLoading;
  void isPro; // kept for API compatibility

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={isAnyLoading}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-zinc-900 border border-white/10 hover:border-white/20 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
        aria-label="Export options"
      >
        {isAnyLoading ? (
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        )}
        {t("training.export")}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-white/10 rounded-xl shadow-xl min-w-[160px] overflow-hidden">
          <button onClick={exportTraining} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-300 hover:bg-zinc-700 hover:text-white transition-colors text-left">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {t("csv.button.training")}
          </button>
          <button onClick={exportTechniques} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-300 hover:bg-zinc-700 hover:text-white transition-colors text-left">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            {t("csv.button.techniques")}
          </button>
          <div className="border-t border-white/10" />
          <button onClick={() => { setOpen(false); onPdf(); }} disabled={pdfLoading} className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-300 hover:bg-zinc-700 hover:text-white transition-colors text-left disabled:opacity-50">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            {t("training.printPDF")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TrainingLog({ userId, isPro = false, initialOpen = false }: Props) {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [techniqueSuggestions, setTechniqueSuggestions] = useState<string[]>([]);
  const PAGE_SIZE = 10;
  // B-05: initialOpen=true when ?welcome=1 + no logs (new user Aha! moment)
  const [showForm, setShowForm] = useState(initialOpen);
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
  const [pdfLoading, setPdfLoading] = useState(false);

  const [showCelebration, setShowCelebration] = useState(false);
  const today = getLocalDateString();
  const [form, setForm] = useState({
    date: getLocalDateString(),
    duration_min: 60,
    type: "gi",
    notes: "",
    instructor_name: "",
    partner_username: "",   // B-09: sparring partner tag
    weight: "",             // Body Management: post-training weight (kg)
    roll_focus: "",         // Roll Details: Focus theme (gi/nogi only)
    partner_belt: "",       // Roll Details: Partner belt color
    size_diff: "",          // Roll Details: Partner size diff
  });

  // #72: detect ?addLog=YYYY-MM-DD from calendar empty-day click
  // B-05: also clean up ?welcome=1 from URL after mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const addLogDate = params.get("addLog");
    const hasWelcome = params.has("welcome");

    if (addLogDate && /^\d{4}-\d{2}-\d{2}$/.test(addLogDate)) {
      setForm((f) => ({ ...f, date: addLogDate }));
      setShowForm(true);
    }

    // Clean up transient URL params without triggering navigation
    if (addLogDate || hasWelcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete("addLog");
      url.searchParams.delete("welcome");
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
  // useMemo ensures the same client instance across renders (prevents useCallback dep churn)
  const supabase = useMemo(() => createClient(), []);
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

      // Free plan: restrict visible history to the last 30 days (JST)
      const oneMonthAgoDate = (() => {
        const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 10);
      })();

      let logsQuery = supabase
        .from("training_logs")
        .select("id, date, duration_min, type, notes, created_at, instructor_name, partner_username")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (!isPro) logsQuery = logsQuery.gte("date", oneMonthAgoDate);

      let countQuery = supabase
        .from("training_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (!isPro) countQuery = countQuery.gte("date", oneMonthAgoDate);

      const [{ data, error }, { data: techData }, { count }] = await Promise.all([
        logsQuery.range(0, PAGE_SIZE - 1),
        // Phase 2.5: fetch technique names for autocomplete suggestions
        supabase
          .from("technique_nodes")
          .select("label")
          .eq("user_id", userId)
          .order("label", { ascending: true }),
        // #138: total session count for header badge
        countQuery,
      ]);

      if (!error && data) {
        setEntries(data);
        setPage(1);
        setTrainedToday(data.some((e: TrainingEntry) => e.date === getLocalDateString()));
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
          setToast({ message: t("training.restoredDraft"), type: "success" });
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
      : (form.type === "gi" || form.type === "nogi")
        ? encodeRollNotes(form.roll_focus, form.partner_belt, form.size_diff, form.notes)
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
    setForm({ date: getLocalDateString(), duration_min: 60, type: "gi", notes: "", instructor_name: "", partner_username: "", weight: "", roll_focus: "", partner_belt: "", size_diff: "" });
    setCompForm({ result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi" });

    // Parse weight: convert non-empty string to number, otherwise null
    const weightNum = form.weight !== "" ? parseFloat(form.weight) : null;
    const weightValue = weightNum !== null && !isNaN(weightNum) && weightNum > 0 ? weightNum : null;

    setLoading(true);
    const { data, error } = await supabase
      .from("training_logs")
      .insert([{ id: idempotencyKey.current, ...form, notes: finalNotes, user_id: userId, weight: weightValue }])
      .select()
      .single();

    if (!error && data) {
      if (typeof navigator !== "undefined") navigator.vibrate?.([50]);
      setEntries((prev) => prev.map((e) => e.id === optimisticId ? data : e));
      // First roll celebration (#7) — trigger before incrementing so we can check 0
      if (totalCount === 0) setShowCelebration(true);
      setTotalCount((c) => (c !== null ? c + 1 : null));
      // B-03: Track log count for PWA install prompt timing (show after 3rd log)
      if (typeof localStorage !== "undefined") {
        const prev = parseInt(localStorage.getItem("bjj_log_count") ?? "0", 10);
        localStorage.setItem("bjj_log_count", String(prev + 1));
      }
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

  // ⑫ PDF Export: generates a print-ready popup with full training log table
  const handlePdfExport = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      // Fetch all visible logs (30-day limit for free plan)
      let allLogsQuery = supabase
        .from("training_logs")
        .select("date, duration_min, type, notes, instructor_name")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (!isPro) {
        const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
        d.setMonth(d.getMonth() - 1);
        allLogsQuery = allLogsQuery.gte("date", d.toISOString().slice(0, 10));
      }
      const { data: allLogs } = await allLogsQuery;

      const logs = allLogs ?? [];
      const typeLabel = (type: string) =>
        TRAINING_TYPES.find((tt) => tt.value === type)?.label ?? type;
      const fmtDuration = (min: number) => {
        if (min < 60) return `${min}m`;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m > 0 ? `${h}h${m}m` : `${h}h`;
      };

      const rows = logs
        .map((l) => {
          const rawNotes = l.notes ?? "";
          const displayNotes = rawNotes.startsWith("__comp__")
            ? decodeCompNotes(rawNotes).userNotes
            : rawNotes;
          return `<tr>
            <td>${l.date}</td>
            <td>${typeLabel(l.type)}</td>
            <td style="text-align:center">${fmtDuration(l.duration_min ?? 0)}</td>
            <td>${l.instructor_name ?? ""}</td>
            <td>${displayNotes.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
          </tr>`;
        })
        .join("");

      const totalMin = logs.reduce((s, l) => s + (l.duration_min ?? 0), 0);
      const totalH = Math.floor(totalMin / 60);
      const totalM = totalMin % 60;
      const totalStr = totalM > 0 ? `${totalH}h${totalM}m` : `${totalH}h`;

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <title>BJJ Training Log</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 11px; color: #111; margin: 16px; }
          h1 { font-size: 16px; margin-bottom: 4px; }
          .meta { color: #555; font-size: 10px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1a1a2e; color: white; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
          td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 12px; font-size: 10px; color: #555; text-align: right; }
          @media print { body { margin: 0; } }
        </style>
      </head><body>
        <h1>🥋 BJJ Training Log</h1>
        <div class="meta">Exported ${new Date().toLocaleDateString()} · ${logs.length} sessions · ${totalStr} total</div>
        <table>
          <thead><tr><th>Date</th><th>Type</th><th>Duration</th><th>Instructor</th><th>Notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">bjj-app.net</div>
        <script>window.addEventListener("load", () => { window.print(); });<\/script>
      </body></html>`;

      const win = window.open("", "_blank", "width=900,height=700");
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDelete = useCallback((id: string) => {
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
  }, [entries, pendingDelete, userId, supabase, t]);

  const cancelEdit = useCallback(() => setEditingId(null), []);

  const startEdit = useCallback((entry: TrainingEntry) => {
    setEditingId(entry.id);
    // ⑧ Fix: decode __comp__ prefix so competition notes display cleanly in the edit textarea
    const displayNotes = entry.type === "competition"
      ? decodeCompNotes(entry.notes).userNotes
      : entry.notes;
    setEditForm({
      date: entry.date,
      duration_min: entry.duration_min,
      type: entry.type,
      notes: displayNotes,
    });
    if (entry.type === "competition") {
      const { comp } = decodeCompNotes(entry.notes);
      if (comp) setEditCompForm(comp);
      else setEditCompForm({ result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi" });
    }
  }, []);

  const handleUpdate = useCallback(async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const finalEditNotes = editForm.type === "competition"
      ? encodeCompNotes(editCompForm, editForm.notes)
      : editForm.notes;

    // Optimistic update: apply immediately, rollback on error
    const prevEntry = entries.find((en) => en.id === id);
    setEntries((prev) => prev.map((en) => en.id === id ? { ...en, ...editForm, notes: finalEditNotes } : en));
    setEditingId(null);
    setToast({ message: t("training.updated"), type: "success" });

    const { data, error } = await supabase
      .from("training_logs")
      .update({ ...editForm, notes: finalEditNotes })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, date, duration_min, type, notes, created_at, instructor_name, partner_username")
      .single();

    if (!error && data) {
      // Reconcile with server response (ensures created_at etc. are accurate)
      setEntries((prev) => prev.map((en) => en.id === id ? data : en));
    } else {
      // Rollback optimistic change and re-open edit form
      if (prevEntry) setEntries((prev) => prev.map((en) => en.id === id ? prevEntry : en));
      setEditingId(id);
      setToast({ message: t("training.updateFailed"), type: "error" });
    }
  }, [editForm, editCompForm, entries, userId, supabase, t]);

  const handlePageChange = useCallback(async (newPage: number) => {
    setPageLoading(true);
    const from = (newPage - 1) * PAGE_SIZE;
    const to = newPage * PAGE_SIZE - 1;
    let query = supabase
      .from("training_logs")
      .select("id, date, duration_min, type, notes, created_at, instructor_name, partner_username")
      .eq("user_id", userId)
      .order("date", { ascending: false });
    if (!isPro) {
      const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
      d.setMonth(d.getMonth() - 1);
      query = query.gte("date", d.toISOString().slice(0, 10));
    }
    const { data, error } = await query.range(from, to);

    if (!error && data) {
      setEntries(data);
      setPage(newPage);
    }
    setPageLoading(false);
  }, [userId, supabase, isPro]);

  const totalPages = useMemo(() => Math.ceil((totalCount ?? 0) / PAGE_SIZE), [totalCount]);

  // Period filter start date — memoized so it's not recomputed on every render
  const periodStart = useMemo((): string | null => {
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
  }, [periodFilter]);

  // Type filter + period filter + keyword search — only recomputed when filter criteria or entries change
  const filtered = useMemo(() => entries
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
    }), [entries, filterType, periodStart, dateFrom, dateTo, searchQuery]);

  // This month stats — memoized, only recomputed when entries change
  const { monthEntries, monthHoursDisplay, monthProjected, remainingDaysLog, monthDelta } = useMemo(() => {
    const thisMonth = getLocalDateString().slice(0, 7);
    const me = entries.filter((e) => e.date.startsWith(thisMonth));
    const totalMins = me.reduce((sum, e) => sum + e.duration_min, 0);
    const hoursDisplay = totalMins >= 60
      ? `${Math.floor(totalMins / 60)}h${totalMins % 60 > 0 ? `${totalMins % 60}m` : ""}`
      : `${totalMins}m`;
    const { day: curDay, month: curMonth, year: curYear, daysInMonth } = getLocalDateParts();
    const projected = curDay > 0 ? Math.round(me.length / curDay * daysInMonth) : 0;
    const remaining = daysInMonth - curDay;
    const prevM = curMonth === 1 ? 12 : curMonth - 1;
    const prevY = curMonth === 1 ? curYear - 1 : curYear;
    const prevYM = `${prevY}-${String(prevM).padStart(2, "0")}`;
    const lastMonthCount = entries.filter((e) => {
      if (!e.date.startsWith(prevYM)) return false;
      return parseInt(e.date.slice(8, 10), 10) <= curDay;
    }).length;
    return {
      monthEntries: me,
      monthHoursDisplay: hoursDisplay,
      monthProjected: projected,
      remainingDaysLog: remaining,
      monthDelta: me.length - lastMonthCount,
    };
  }, [entries]);

  // Suppress unused-var TS warnings for stats used in Bento/Analytics (kept for future use)
  void monthHoursDisplay;
  void monthProjected;
  void remainingDaysLog;
  void monthDelta;

  return (
    <div>
      {/* First roll celebration overlay (#7) */}
      {showCelebration && (
        <FirstRollCelebration onDismiss={() => setShowCelebration(false)} />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onUndo={toast.onUndo}
          onClose={() => setToast(null)}
        />
      )}

      {/* Stats (weekly summary) */}
      <TrainingLogStats entries={entries} totalPages={totalPages} page={page} />

      {/* Monthly Bento Grid section */}
      {!initialLoading && monthEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-zinc-900 rounded-xl p-3 border border-white/10 flex items-center gap-3">
            <MiniTypeDonut entries={monthEntries} />
            <div>
              <p className="text-xs text-gray-500 tracking-wide">{t("training.monthCount")}</p>
              <p className="text-lg font-bold text-white">{monthEntries.length}</p>
              <p className="text-xs text-gray-400">{t("training.bentoSessions")}</p>
            </div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-3 border border-white/10">
            <p className="text-xs text-gray-500 tracking-wide mb-1.5">{t("training.bentoTypeMix")}</p>
            <MonthTypeStackBar entries={monthEntries} />
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1.5">
              {TRAINING_TYPES.filter((t) => monthEntries.some((e) => e.type === t.value)).map((t) => (
                <span key={t.value} className="text-xs text-gray-500">
                  {t.icon} {t.label}: {monthEntries.filter((e) => e.type === t.value).length}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Free plan: 30-day history limit notice */}
      {!isPro && !initialLoading && (
        <div className="mb-3 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 flex items-center justify-between gap-3">
          <span className="text-xs text-amber-300/80">
            🗓 Free plan: showing last 30 days
          </span>
          <span className="text-xs font-medium text-blue-400 whitespace-nowrap">Upgrade for full history →</span>
        </div>
      )}

      {/* Header row — title + Export ▼ dropdown + Add CTA (item 2: de-cluttered) */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-lg font-semibold flex-1 min-w-0">
          {t("training.title")}
          {totalCount !== null && totalCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">({totalCount})</span>
          )}
        </h3>
        <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
          <ExportDropdown userId={userId} isPro={isPro} onPdf={handlePdfExport} pdfLoading={pdfLoading} />
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
          >
            {t("training.add")}
          </button>
        </div>
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("training.searchPlaceholder")}
            className="w-full bg-zinc-800 text-white rounded-xl pl-9 pr-9 py-2 text-sm border border-white/20 focus:outline-none focus:border-white/30 placeholder-gray-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Unified filter row: Period + Type + DateFilter — all flat siblings in one flex container */}
      {!initialLoading && entries.length > 0 && (() => {
        const usedTypes = TRAINING_TYPES.filter((tt) => entries.some((e) => e.type === tt.value));
        const pillTypes = usedTypes.slice(0, 2);
        const dropdownTypes = usedTypes.slice(2);
        const hasDateFilter = !!(dateFrom || dateTo);
        return (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Period — item 3: select dropdown (logically separate from type pills) */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as "all" | "month" | "week")}
              className="flex-shrink-0 bg-zinc-900 text-xs text-gray-300 border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white/30 cursor-pointer hover:border-white/20 transition-colors"
              aria-label="Filter by period"
            >
              <option value="all">{t("training.periodAll")}</option>
              <option value="month">{t("training.periodMonth")}</option>
              <option value="week">{t("training.periodWeek")}</option>
            </select>
            {/* Divider */}
            <div className="w-px h-4 bg-white/10 flex-shrink-0" />
            {/* Type: All */}
            <button
              onClick={() => setFilterType("all")}
              className={`flex-shrink-0 px-3 py-1.5 min-h-[32px] rounded-full text-xs font-medium transition-colors active:scale-95 ${
                filterType === "all"
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-900 text-gray-400 border border-white/10 hover:text-gray-300"
              }`}
            >
              {t("training.all")}
            </button>
            {/* Type pills */}
            {pillTypes.map((tt) => (
              <button
                key={tt.value}
                onClick={() => setFilterType(tt.value)}
                className={`flex-shrink-0 px-3 py-1.5 min-h-[32px] rounded-full text-xs font-medium transition-colors active:scale-95 ${
                  filterType === tt.value
                    ? "bg-zinc-600 text-white"
                    : "bg-zinc-900 text-gray-400 border border-white/10 hover:text-gray-300"
                }`}
              >
                {tt.label}
              </button>
            ))}
            {dropdownTypes.length > 0 && (
              <select
                value={dropdownTypes.some((tt) => tt.value === filterType) ? filterType : ""}
                onChange={(e) => e.target.value && setFilterType(e.target.value as typeof filterType)}
                className={`flex-shrink-0 text-xs rounded-full px-2 py-1 border transition-colors cursor-pointer bg-zinc-900 border-white/10 ${
                  dropdownTypes.some((tt) => tt.value === filterType)
                    ? "text-white bg-zinc-600"
                    : "text-gray-400"
                }`}
              >
                <option value="">{t("training.more")} ▾</option>
                {dropdownTypes.map((tt) => (
                  <option key={tt.value} value={tt.value}>{tt.label}</option>
                ))}
              </select>
            )}
            {/* Divider */}
            <div className="w-px h-4 bg-white/10 flex-shrink-0" />
            {/* Date filter: pill button when inactive, inline inputs when active */}
            {!hasDateFilter ? (
              <button
                onClick={() => setDateFrom(today)}
                className="flex-shrink-0 px-3 py-1.5 min-h-[32px] rounded-full text-xs font-medium transition-colors active:scale-95 text-gray-400 border border-white/10 hover:text-gray-300 hover:border-white/20"
              >
                <svg className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                {t("training.filterByDate")}
              </button>
            ) : (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || today}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-28 flex-shrink-0 bg-zinc-900 text-white text-xs rounded-lg px-2 py-1 border border-white/10 focus:outline-none focus:border-white/30"
                />
                <span className="text-gray-500 text-xs flex-shrink-0">–</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  max={today}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-28 flex-shrink-0 bg-zinc-900 text-white text-xs rounded-lg px-2 py-1 border border-white/10 focus:outline-none focus:border-white/30"
                />
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  className="flex-shrink-0 text-gray-500 hover:text-white text-xs px-1 transition-colors"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        );
      })()}

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
        onCancelEdit={cancelEdit}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        deletingId={deletingId}
        page={page}
        totalPages={totalPages}
        pageLoading={pageLoading}
        onPageChange={handlePageChange}
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
        className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-2xl font-bold rounded-full shadow-lg shadow-[#10B981]/40 transition-all flex items-center justify-center print:hidden"
        aria-label={t("training.logSession")}
      >
        +
      </button>
    </div>
  );
}

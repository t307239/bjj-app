"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { useLocale } from "@/lib/i18n";
import Toast from "./Toast";
import TrainingLogForm from "./TrainingLogForm";
import TrainingLogList from "./TrainingLogList";
import TrainingLogStats from "./TrainingLogStats";
import FirstRollCelebration from "./FirstRollCelebration";
import { useTrainingLog } from "@/hooks/useTrainingLog";
import { decodeCompNotes } from "@/lib/trainingLogHelpers";

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
      const { data: logs , error } = await supabase
        .from("training_logs").select("date,type,duration_min,notes").eq("user_id", userId).order("date", { ascending: false });
      if (error) console.error("TrainingLog.tsx:query", error);
      if (!logs) return;
      const headers = ["Date","Type","Duration(min)","Result","Opponent","Finish","Event","Notes"];
      const rows = (logs as { date: string; type: string; duration_min: number; notes: string }[]).map((l) => {
        const { comp, userNotes } = decodeCompNotes(l.notes ?? "");
        return [l.date, l.type, l.duration_min ?? "", comp?.result ?? "", comp?.opponent ?? "", comp?.finish ?? "", comp?.event ?? "", (userNotes ?? "").replace(/"/g, '""')];
      });
      downloadCsv([headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n"),
        `bjj_training_${new Date().toISOString().slice(0,10)}.csv`);
    } finally { setLoadingLogs(false); }
  };

  const exportTechniques = async () => {
    setLoadingTech(true); setOpen(false);
    try {
      const { data: techs , error } = await supabase
        .from("techniques").select("name,category,mastery_level,notes").eq("user_id", userId).order("name");
      if (error) console.error("TrainingLog.tsx:query", error);
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
  const { t } = useLocale();
  const {
    today,
    entries,
    loading,
    initialLoading,
    pageLoading,
    page,
    techniqueSuggestions,
    partnerSuggestions,
    totalCount, setTotalCount,
    trainedToday, setTrainedToday,
    showCelebration, setShowCelebration,
    pdfLoading,
    showForm, setShowForm,
    form, setForm,
    compForm, setCompForm,
    formError, setFormError,
    editingId, setEditingId,
    editForm, setEditForm,
    editCompForm, setEditCompForm,
    filterType, setFilterType,
    periodFilter, setPeriodFilter,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    searchQuery, setSearchQuery,
    expandedNotes, setExpandedNotes,
    toast, setToast,
    deletingId,
    handleSubmit,
    handlePdfExport,
    handleDelete,
    cancelEdit,
    startEdit,
    handleUpdate,
    handlePageChange,
    totalPages,
    filtered,
    monthEntries,
    monthHoursDisplay,
    monthProjected,
    remainingDaysLog,
    monthDelta,
  } = useTrainingLog({ userId, isPro, initialOpen, t });

  const [listOpen, setListOpen] = useState(true);

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

      {/* Header row — title + Export ▼ dropdown + Add CTA */}
      <div className="flex flex-wrap items-center justify-between mb-3 gap-x-2 gap-y-1">
        <h3 className="text-lg font-semibold whitespace-nowrap">
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
        partnerSuggestions={partnerSuggestions}
      />

      {/* Collapsible log list toggle */}
      {!initialLoading && entries.length > 0 && !showForm && (
        <button
          onClick={() => setListOpen((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span>{listOpen ? t("training.hideHistory") : t("training.showHistory")}</span>
          <svg className={`w-3.5 h-3.5 transition-transform ${listOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {/* --- Collapsible section: stats, search, filters, list --- */}
      {listOpen && !initialLoading && entries.length > 0 && (
        <>
          {/* Stats (weekly summary) */}
          <TrainingLogStats entries={entries} totalPages={totalPages} page={page} />

          {/* Monthly Bento Grid section */}
          {monthEntries.length > 0 && (
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
          {!isPro && (
            <div className="mb-3 px-4 py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/8 flex items-center justify-between gap-3">
              <span className="text-xs text-amber-300/80">
                {t("training.freePlanNotice")}
              </span>
              <span className="text-xs font-medium text-blue-400 whitespace-nowrap">{t("training.upgradeFullHistory")}</span>
            </div>
          )}
        </>
      )}

      {/* Keyword search — always inside collapsible */}
      {listOpen && !initialLoading && entries.length > 0 && (
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

      {/* Unified filter row: horizontal scroll chip bar — Period + Type pills + Date */}
      {listOpen && !initialLoading && entries.length > 0 && (() => {
        const usedTypes = TRAINING_TYPES.filter((tt) => entries.some((e) => e.type === tt.value));
        const hasDateFilter = !!(dateFrom || dateTo);
        return (
          <div className="overflow-x-auto scrollbar-hide mb-4 -mx-0.5 px-0.5">
            <div className="flex items-center gap-2 min-w-max">
              {/* Period select */}
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
              {/* All pill */}
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
              {/* Type pills — all shown, no overflow dropdown */}
              {usedTypes.map((tt) => (
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
              {/* Divider */}
              <div className="w-px h-4 bg-white/10 flex-shrink-0" />
              {/* Date filter: pill when inactive, inline inputs when active */}
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
          </div>
        );
      })()}

      {/* Entry list — only when list is open */}
      {listOpen && <TrainingLogList
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
      />}

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

"use client";

/**
 * useTrainingLog — Data layer hook for TrainingLog.
 * All Supabase operations, pagination, filtering, and computed stats.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import {
  type TrainingEntry,
  type CompData,
  getLocalDateString,
  encodeCompNotes,
  decodeCompNotes,
  encodeRollNotes,
} from "@/lib/trainingLogHelpers";
import { getLocalDateParts, getLogicalTrainingDate } from "@/lib/timezone";

// z158/z159: ユーザーのローカル TZ における "N ヶ月前" の日付を YYYY-MM-DD で返す。
// 旧実装は `Date.now() + 9 * 60 * 60 * 1000` で JST ハードコードだったため
// PT (UTC-3) / EN (UTC-4/5/8) ユーザーでは cutoff 境界が翌日ずれていた。
function monthsAgoLocalDate(monthsBack: number): string {
  const todayStr = getLocalDateString();  // user's local TZ
  const [y, m, d] = todayStr.split("-").map(Number);
  // UTC で同じ年月日を組み立てて月減算 (月末繰越は UTC-semantics で OK)
  const past = new Date(Date.UTC(y, m - 1 - monthsBack, d));
  return past.toISOString().slice(0, 10);
}
import { trackEvent } from "@/lib/analytics";

const PAGE_SIZE = 10;

/** Generate a contextual one-liner insight after saving a training log */
function generateInsight(
  existingEntries: TrainingEntry[],
  newEntry: TrainingEntry,
  prevTotal: number | null,
  t: (k: string, vars?: Record<string, string>) => string,
): string {
  const newTotal = (prevTotal ?? 0) + 1;

  // Milestone check: 10, 25, 50, 100, 200, 500, 1000
  const milestones = [10, 25, 50, 100, 200, 500, 1000];
  if (milestones.includes(newTotal)) {
    return t("insight.milestone", { n: String(newTotal) });
  }

  // Week count (how many sessions this week including the new one)
  const todayDate = new Date(newEntry.date + "T00:00:00Z");
  const dayOfWeek = todayDate.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayMs = todayDate.getTime() - mondayOffset * 86400000;
  const mondayStr = new Date(mondayMs).toISOString().slice(0, 10);
  const weekEntries = existingEntries.filter((e) => e.date >= mondayStr).length + 1;

  if (weekEntries >= 5) return t("insight.weekFive");
  if (weekEntries >= 3) return t("insight.weekThree", { n: String(weekEntries) });

  // Type variety check
  const recentTypes = new Set(existingEntries.slice(0, 5).map((e) => e.type));
  recentTypes.add(newEntry.type);
  if (recentTypes.size >= 3) return t("insight.variety");

  // Duration check
  if (newEntry.duration_min >= 120) return t("insight.longSession");

  // Default
  return t("training.saved");
}

type UseTrainingLogProps = {
  userId: string;
  isPro: boolean;
  initialOpen: boolean;
  t: (k: string, vars?: Record<string, string>) => string;
};

export function useTrainingLog({ userId, isPro, initialOpen, t }: UseTrainingLogProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  // t is recreated every render by makeT() — use ref to keep deps stable
  const tRef = useRef(t);
  tRef.current = t;
  const idempotencyKey = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  );

  const today = getLocalDateString();

  // ── Core data state ───────────────────────────────────────────────────────
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [techniqueSuggestions, setTechniqueSuggestions] = useState<string[]>([]);
  const [partnerSuggestions, setPartnerSuggestions] = useState<string[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [trainedToday, setTrainedToday] = useState<boolean | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastInsight, setLastInsight] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // ── Form state ────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(initialOpen);
  // OP1: Load last-used duration/type from localStorage for preset defaults
  const [form, setForm] = useState(() => {
    let lastDuration = 60;
    let lastType = "gi";
    if (typeof localStorage !== "undefined") {
      try {
        const saved = localStorage.getItem("bjj_form_defaults");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.duration_min && typeof parsed.duration_min === "number") lastDuration = parsed.duration_min;
          if (parsed.type && typeof parsed.type === "string") lastType = parsed.type;
        }
      } catch { /* ignore */ }
    }
    return {
      date: getLogicalTrainingDate(),
      duration_min: lastDuration,
      type: lastType,
      notes: "",
      instructor_name: "",
      partner_username: "",
      weight: "",
      roll_focus: "",
      partner_belt: "",
      size_diff: "",
      gi_name: "",
    };
  });
  const [compForm, setCompForm] = useState<CompData>({
    result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    date: "",
    duration_min: 60,
    type: "gi",
    notes: "",
  });
  const [editCompForm, setEditCompForm] = useState<CompData>({
    result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi",
  });

  // ── Filter + search state ─────────────────────────────────────────────────
  const [filterType, setFilterType] = useState("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "month" | "week">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // ── UI feedback state ─────────────────────────────────────────────────────
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
    duration?: number;
    onUndo?: () => void;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    entry: TrainingEntry;
    timerId: ReturnType<typeof setTimeout>;
  } | null>(null);

  // ── ?addLog= and ?welcome= URL param handling ─────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const addLogDate = params.get("addLog");
    const hasWelcome = params.has("welcome");

    if (addLogDate && /^\d{4}-\d{2}-\d{2}$/.test(addLogDate)) {
      setForm((f) => ({ ...f, date: addLogDate }));
      setShowForm(true);
    }

    // §6 Telemetry: Fire signup_completed when new user arrives via auth callback
    if (hasWelcome) {
      trackEvent("signup_completed");
    }

    if (addLogDate || hasWelcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete("addLog");
      url.searchParams.delete("welcome");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // ── Debounce search query (300ms) ──────────────────────────────────────────
  useEffect(() => {
    const timerId = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timerId);
  }, [searchQuery]);

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const loadEntries = async () => {
      setInitialLoading(true);

      // z159: JST 固定 +9h → ユーザーTZ尊重 (monthsAgoLocalDate)
      const oneMonthAgoDate = monthsAgoLocalDate(1);

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

      const [{ data, error }, { data: techData }, { data: partnerData }, { count }] = await Promise.all([
        logsQuery.range(0, PAGE_SIZE - 1),
        supabase
          .from("technique_nodes")
          .select("name")
          .eq("user_id", userId)
          .order("name", { ascending: true }),
        supabase
          .from("training_logs")
          .select("partner_username")
          .eq("user_id", userId)
          .not("partner_username", "is", null)
          .neq("partner_username", ""),
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
        const names = [...new Set(techData.map((t: { name: string }) => t.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ja"));
        setTechniqueSuggestions(names);
      }
      if (partnerData) {
        const partners = [...new Set(
          partnerData
            .map((r: { partner_username: string | null }) => r.partner_username)
            .filter((p): p is string => !!p && p.trim() !== "")
        )].sort();
        setPartnerSuggestions(partners);
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

  // ── Server-side search (triggered by debounced query) ─────────────────────
  const isInitialMount = useRef(true);
  useEffect(() => {
    // Skip on initial mount — loadEntries handles first fetch
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const searchEntries = async () => {
      setSearchLoading(true);
      const q = debouncedSearch;

      let logsQuery = supabase
        .from("training_logs")
        .select("id, date, duration_min, type, notes, created_at, instructor_name, partner_username")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      let countQuery = supabase
        .from("training_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (!isPro) {
        // z159: JST 固定 → ユーザーTZ尊重
        const cutoff = monthsAgoLocalDate(1);
        logsQuery = logsQuery.gte("date", cutoff);
        countQuery = countQuery.gte("date", cutoff);
      }

      if (q) {
        const filter = `notes.ilike.%${q}%,instructor_name.ilike.%${q}%,partner_username.ilike.%${q}%`;
        logsQuery = logsQuery.or(filter);
        countQuery = countQuery.or(filter);
      }

      const [{ data, error }, { count }] = await Promise.all([
        logsQuery.range(0, PAGE_SIZE - 1),
        countQuery,
      ]);

      if (!error && data) {
        setEntries(data);
        setPage(1);
      }
      if (count !== null) setTotalCount(count);
      setSearchLoading(false);
    };

    searchEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  // ── Submit (add new log) ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (form.date > today) { setFormError(t("training.futureDate")); return; }
    if (form.duration_min < 1 || form.duration_min > 480) { setFormError(t("training.durationRange")); return; }

    const finalNotes = form.type === "competition"
      ? encodeCompNotes(compForm, form.notes)
      : (form.type === "gi" || form.type === "nogi")
        ? encodeRollNotes(form.roll_focus, form.partner_belt, form.size_diff, form.notes, form.gi_name)
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
    // I-17: Restore scroll position to top after closing form (prevents snap to bottom)
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" });
    // OP1: Save last-used duration/type as defaults for next session
    if (typeof localStorage !== "undefined") {
      try { localStorage.setItem("bjj_form_defaults", JSON.stringify({ duration_min: form.duration_min, type: form.type })); } catch { /* ignore */ }
    }
    setForm({ date: getLocalDateString(), duration_min: form.duration_min, type: form.type, notes: "", instructor_name: "", partner_username: "", weight: "", roll_focus: "", partner_belt: "", size_diff: "", gi_name: "" });
    setCompForm({ result: "win", opponent: "", finish: "", event: "", opponent_rank: "", gi_type: "gi" });

    const weightNum = form.weight !== "" ? parseFloat(form.weight) : null;
    const weightValue = weightNum !== null && !isNaN(weightNum) && weightNum > 0 ? weightNum : null;

    // Whitelist: only DB columns — prevents PostgREST rejection from unknown fields
    const insertPayload = {
      id: idempotencyKey.current,
      user_id: userId,
      date: form.date,
      duration_min: form.duration_min,
      type: form.type,
      notes: finalNotes,
      instructor_name: form.instructor_name,
      partner_username: form.partner_username,
      weight: weightValue,
    };

    setLoading(true);
    const { data, error } = await supabase
      .from("training_logs")
      .insert([insertPayload])
      .select()
      .single();

    if (!error && data) {
      if (typeof navigator !== "undefined") navigator.vibrate?.([50]);
      setEntries((prev) => prev.map((e) => e.id === optimisticId ? data : e));
      if (totalCount === 0) {
        setShowCelebration(true);
        trackEvent("first_training_logged", { type: form.type });
      }
      setTotalCount((c) => (c !== null ? c + 1 : null));
      if (typeof localStorage !== "undefined") {
        const prev = parseInt(localStorage.getItem("bjj_log_count") ?? "0", 10);
        localStorage.setItem("bjj_log_count", String(prev + 1));
      }
      trackEvent("training_logged", { type: form.type });
      // §2 Logic: Revalidate server-rendered data after successful save
      router.refresh();

      // ── Post-training insight (one-liner feedback) ─────────────────
      const insight = generateInsight(entries, data, totalCount, tRef.current);
      setLastInsight(insight);
      setToast({ message: insight, type: "success" });
      idempotencyKey.current = typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== optimisticId));
      setShowForm(true);
      const isAuthError = error?.code === "401"
        || error?.message?.toLowerCase().includes("jwt")
        || error?.message?.toLowerCase().includes("unauthorized");
      if (isAuthError) {
        try { localStorage.setItem("pending_training_log", JSON.stringify({ ...form, notes: finalNotes })); } catch { /* ignore */ }
        router.push("/login?reason=session_expired");
      } else {
        setToast({ message: t("training.saveFailed"), type: "error" });
      }
      idempotencyKey.current = typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    }
    setLoading(false);
  };

  // ── PDF export ────────────────────────────────────────────────────────────
  const handlePdfExport = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    try {
      let allLogsQuery = supabase
        .from("training_logs")
        .select("date, duration_min, type, notes, instructor_name")
        .eq("user_id", userId)
        .order("date", { ascending: false });
      if (!isPro) {
        // z159: JST 固定 → ユーザーTZ尊重
        allLogsQuery = allLogsQuery.gte("date", monthsAgoLocalDate(1));
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
      if (win) { win.document.write(html); win.document.close(); }
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Delete (with undo) ────────────────────────────────────────────────────
  const handleDelete = useCallback((id: string) => {
    const removed = entries.find((e) => e.id === id);
    if (!removed) return;

    if (pendingDelete) {
      clearTimeout(pendingDelete.timerId);
      void supabase
        .from("training_logs")
        .delete()
        .eq("id", pendingDelete.id)
        .eq("user_id", userId);
      setTotalCount((c) => (c !== null ? Math.max(0, c - 1) : null));
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
        router.refresh();
      } else {
        setEntries((prev) => [removed, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        setToast({ message: tRef.current("training.deleteFailed"), type: "error" });
      }
      setDeletingId(null);
    }, 5000);

    setPendingDelete({ id, entry: removed, timerId });

    setToast({
      message: tRef.current("training.deletedUndo"),
      type: "success",
      duration: 5000,
      onUndo: () => {
        clearTimeout(timerId);
        setPendingDelete(null);
        setEntries((prev) => [removed, ...prev].sort((a, b) => b.date.localeCompare(a.date)));
        setToast(null);
      },
    });
  }, [entries, pendingDelete, userId, supabase]); // t via tRef

  // ── Edit ──────────────────────────────────────────────────────────────────
  const cancelEdit = useCallback(() => setEditingId(null), []);

  const startEdit = useCallback((entry: TrainingEntry) => {
    setEditingId(entry.id);
    const displayNotes = entry.type === "competition"
      ? decodeCompNotes(entry.notes).userNotes
      : entry.notes;
    setEditForm({ date: entry.date, duration_min: entry.duration_min, type: entry.type, notes: displayNotes });
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

    const prevEntry = entries.find((en) => en.id === id);
    setEntries((prev) => prev.map((en) => en.id === id ? { ...en, ...editForm, notes: finalEditNotes } : en));
    setEditingId(null);
    setToast({ message: tRef.current("training.updated"), type: "success" });

    // Whitelist: only DB columns
    const updatePayload = {
      date: editForm.date,
      duration_min: editForm.duration_min,
      type: editForm.type,
      notes: finalEditNotes,
    };
    const { data, error } = await supabase
      .from("training_logs")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, date, duration_min, type, notes, created_at, instructor_name, partner_username")
      .single();

    if (!error && data) {
      setEntries((prev) => prev.map((en) => en.id === id ? data : en));
      router.refresh();
    } else {
      if (prevEntry) setEntries((prev) => prev.map((en) => en.id === id ? prevEntry : en));
      setEditingId(id);
      setToast({ message: tRef.current("training.updateFailed"), type: "error" });
    }
  }, [editForm, editCompForm, entries, userId, supabase, router]); // t via tRef

  // ── Pagination ────────────────────────────────────────────────────────────
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
      // z159: JST 固定 → ユーザーTZ尊重
      query = query.gte("date", monthsAgoLocalDate(1));
    }
    // Apply server-side search filter when active
    if (debouncedSearch) {
      query = query.or(`notes.ilike.%${debouncedSearch}%,instructor_name.ilike.%${debouncedSearch}%,partner_username.ilike.%${debouncedSearch}%`);
    }
    const { data, error } = await query.range(from, to);
    if (!error && data) { setEntries(data); setPage(newPage); }
    setPageLoading(false);
  }, [userId, supabase, isPro, debouncedSearch]);

  // ── Memos ─────────────────────────────────────────────────────────────────
  const totalPages = useMemo(() => Math.ceil((totalCount ?? 0) / PAGE_SIZE), [totalCount]);

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

  const filtered = useMemo(() => entries
    .filter((e) => filterType === "all" || e.type === filterType)
    .filter((e) => !periodStart || e.date >= periodStart)
    .filter((e) => !dateFrom || e.date >= dateFrom)
    .filter((e) => !dateTo || e.date <= dateTo),
    [entries, filterType, periodStart, dateFrom, dateTo]);

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

  // ── OP2: Quick-add technique from training form ──────────────────────────
  const handleQuickAddTechnique = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    // Avoid duplicates
    if (techniqueSuggestions.includes(name.trim())) return true;
    const { data, error } = await supabase
      .from("technique_nodes")
      .insert({ user_id: userId, name: name.trim(), pos_x: 100 + Math.random() * 200, pos_y: 100 + Math.random() * 200 })
      .select("name")
      .single();
    if (!error && data) {
      setTechniqueSuggestions((prev) => [...prev, data.name].sort((a, b) => a.localeCompare(b, "ja")));
      return true;
    }
    return false;
  }, [userId, supabase, techniqueSuggestions]);

  return {
    today,
    entries, setEntries,
    loading,
    initialLoading,
    pageLoading,
    searchLoading,
    page,
    techniqueSuggestions,
    partnerSuggestions,
    totalCount, setTotalCount,
    trainedToday, setTrainedToday,
    showCelebration, setShowCelebration,
    lastInsight,
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
    pendingDelete,
    handleSubmit,
    handlePdfExport,
    handleDelete,
    cancelEdit,
    startEdit,
    handleUpdate,
    handlePageChange,
    handleQuickAddTechnique,
    totalPages,
    filtered,
    monthEntries,
    monthHoursDisplay,
    monthProjected,
    remainingDaysLog,
    monthDelta,
  };
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
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
};

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];

// JST対応: toISOString()はUTCなので、ローカル日付を返すヘルパー
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

// 試合詳細データのエンc��〰D@食限不要）
type CompData = { result: string; opponent: string; finish: string; event: string };
const COMP_PREFIX = "__comp__";

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
  win:  { label: "囝利 🏆", color: "text-green-400" },
  loss: { label: "敗北", color: "text-red-400" },
  draw: { label: "引き分け", color: "text-yellow-400" },
};

function buildXShareUrl(entry: { date: string; duration_min: number; type: string; notes: string }): string {
  const typeLabels: Record<string, string> = {
    gi: "道衣(Gi)", nogi: "ノーギ", drilling: "ドリレ", competition: "試合", open_mat: "オープーマット",
  };
  const dur = entry.duration_min >= 60
    ? `${Math.floor(entry.duration_min / 60)}時間${entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}分` : ""}`
    : `${entry.duration_min}m`;
  const lines = [
    `🥋 BJJ練習しみした！ (${entry.date})`,
    `⏱ ${dur} | ${typeLabels[entry.type] ?? entry.type}`,
    entry.notes ? `📝 ${entry.notes}` : "",
    "",
    "練習記録 → https://bjj-app-one.vercel.app",
    "#BJJ #柔術 #ブラジリアン柔術",
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
      <label className="block text-gray-400 text-xs mb-1">時間</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {DURATION_PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              value === d
                ? "bg-[#e94560] text-white"
                : "bg-[#0f3460] text-gray-400 hover:text-white"
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
          step={15}
          className={`w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border focus:outline-none focus:border-blue-400 ${
            isPreset ? "border-gray-600" : "border-[#e94560]"
          }`}
        />
        <span className="text-gray-500 text-xs flex-shrink-0">分</span>
      </div>
    </div>
  );
}

const TRAINING_TYPES = [
  { value: "gi", label: "道衣 (Gi)", color: "bg-blue-500/20 text-blue-300" },
  { value: "nogi", label: "ノーギ (No-Gi)", color: "bg-orange-500/20 text-orange-300" },
  { value: "drilling", label: "ドリル", color: "bg-purple-500/20 text-purple-300" },
  { value: "competition", label: "試合", color: "bg-red-500/20 text-red-300" },
  { value: "open_mat", label: "オープンマット", color: "bg-green-500/20 text-green-300" },
];

export default function TrainingLog({ userId }: Props) {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 20;
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
    result: "win", opponent: "", finish: "", event: "",
  });
  const [editCompForm, setEditCompForm] = useState<CompData>({
    result: "win", opponent: "", finish: "", event: "",
  });
  const supabase = createClient();

  // 初回データ読み込み
  useEffect(() => {
    const loadEntries = async () => {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from("training_logs")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (!error && data) {
        setHasMore(data.length > PAGE_SIZE);
        const slice = data.slice(0, PAGE_SIZE);
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
      setFormError("未来の日付は記録できません");
      return;
    }
    if (form.duration_min < 1 || form.duration_min > 480) {
      setFormError("練習時間は1〜480分の範囲で入力してください");
      return;
    }

    setLoading(true);

    // 試合タイプの場合は詳細データをnotesにエンコード
    const finalNotes = form.type === "competition"
      ? encodeCompNotes(compForm, form.notes)
      : form.notes;

    const { data, error } = await supabase
      .from("training_logs")
      .insert([{ ...form, notes: finalNotes, user_id: userId }])
      .select()
      .single();

    if (!error && data) {
      setEntries([data, ...entries]);
      setForm({
        date: getLocalDateString(),
        duration_min: 60,
        type: "gi",
        notes: "",
      });
      setCompForm({ result: "win", opponent: "", finish: "", event: "" });
      setShowForm(false);
      setToast({ message: "練習を記録しみした！", type: "success" });
    } else {
      setToast({ message: "保存に失敗しみした", type: "error" });
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    setDeletingId(id);

    const { error } = await supabase
      .from("training_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) {
      setEntries(entries.filter((e) => e.id !== id));
      setToast({ message: "記録を削除しました", type: "success" });
    } else {
      setToast({ message: "削除に失敗しました", type: "error" });
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
      else setEditCompForm({ result: "win", opponent: "", finish: "", event: "" });
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
      setToast({ message: "記録を更新しました", type: "success" });
    } else {
      setToast({ message: "更新に失敗しました", type: "error" });
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

  // 期間フィルター計算
  const getPeriodStart = (): string | null => {
    if (periodFilter === "all") return null;
    const now = new Date();
    if (periodFilter === "month") {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    // week: 今週月曜日
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysToMonday);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
  };
  const periodStart = getPeriodStart();

  // タイプフィルター + 期間フィルター + キーワード検索
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

  // 今月の合計時間
  const thisMonth = getLocalDateString().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const monthTotalMins = monthEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const monthHoursDisplay = monthTotalMins >= 60
    ? `${Math.floor(monthTotalMins / 60)}h${monthTotalMins % 60 > 0 ? `${monthTotalMins % 60}m` : ""}`
    : `${monthTotalMins}m`;

  // 今週のサマリー（月曜日起点）
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
      {/* 今日の練習プロンプト */}
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
            <p className="text-[#e94560] text-sm font-medium">今日の練習を記録しよう！</p>
            <p className="text-gray-400 text-xs mt-0.5">タップして練習ログを追加</p>
          </div>
          <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* 週次・月次サマリー */}
      {!initialLoading && entries.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
          {/* 今週サマリー行 */}
          {weekEntries.length > 0 && (
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-700/60">
              <span className="text-[10px] font-semibold text-yellow-400/80 uppercase tracking-wide flex-shrink-0">今週</span>
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-yellow-400">{weekEntries.length}</span>
                  <span className="text-[10px] text-gray-500">回</span>
                </div>
                <div className="w-px h-4 bg-gray-700" />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-yellow-400/80">{weekHoursDisplay}</span>
                  <span className="text-[10px] text-gray-500">合計</span>
                </div>
                {weekEntries.length > 0 && (
                  <>
                    <div className="w-px h-4 bg-gray-700" />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">
                        {formatDuration(Math.round(weekTotalMins / weekEntries.length))}/回
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          {/* $��月サマリー行 */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-[#e94560]">{monthEntries.length}</div>
              <div className="text-gray-400 text-xs">今月の練習</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-blue-400">{monthHoursDisplay}</div>
              <div className="text-gray-400 text-xs">今月の時間</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="flex-1 text-center">
              <div className="text-lg font-bold text-purple-400">
                {monthEntries.length > 0 ? formatDuration(Math.round(monthTotalMins / monthEntries.length)) : "-"}
              </div>
              <div className="text-gray-400 text-xs">平均/回</div>
            </div>
          </div>
          {/* 今月タイプ別内訳ピル */}
          {(() => {
            const typePills = TRAINING_TYPES
              .map((t) => ({ ...t, count: monthEntries.filter((e) => e.type === t.value).length }))
              .filter((t) => t.count > 0);
            if (typePills.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-700/60">
                {typePills.map((t) => (
                  <span key={t.value} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${t.color}`}>
                    {t.label.split(" ")[0]}
                    <span className="opacity-80">×{t.count}</span>
                  </span>
                ))}
              </div>
            );
          })()}
          {hasMore && (
            <p className="text-gray-600 text-xs text-center mt-2">※ 追加データあり。「もっと見る」で更新</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">練習記録</h3>
          <CsvExport userId={userId} />
          {/* 印刷ボタン */}
          <button
            onClick={() => window.print()}
            title="印刷 / PDF保存"
            className="print:hidden flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 bg-[#16213e] border border-gray-700 hover:border-gray-500 px-2 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="print:hidden bg-[#e94560] hover:bg-[#c73652] text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          + 記録を追加
        </button>
      </div>

      {/* キーワード検索 */}
      {!initialLoading && entries.length > 0 && (
        <div className="relative mb-2">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="日付・タイプ・メモ#��検索..."
            className="w-full bg-[#16213e] text-white rounded-xl pl-9 pr-9 py-2 text-sm border border-gray-700 focus:outline-none focus:border-[#e94560]/60 placeholder-gray-600"
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

      {/* 期間フィルター */}
      {!initialLoading && entries.length > 0 && (
        <div className="flex gap-1.5 mb-2">
          {(["all", "month", "week"] as const).map((p) => {
            const label = p === "all" ? "全期間" : p === "month" ? "今月" : "今週";
            return (
              <button
                key={p}
                onClick={() => setPeriodFilter(p)}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  periodFilter === p
                    ? "bg-[#e94560] text-white"
                    : "bg-[#16213e] text-gray-400 border border-gray-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* 日付範囲フィルター */}
      {!initialLoading && entries.length > 0 && (dateFrom || dateTo) ? (
        <div className="flex items-center gap-2 mb-2">
          <input
            type="date"
            value={dateFrom}
            max={dateTo || today}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 bg-[#16213e] text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-[#e94560]/60"
          />
          <span className="text-gray-600 text-xs">〜</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={today}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 bg-[#16213e] text-white text-xs rounded-lg px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-[#e94560]/60"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-gray-500 hover:text-white text-xs px-2">
              ✕
            </button>
          )}
        </div>
      ) : null}

      {/* 日付範囲ボタン（未設定時） */}
      {!initialLoading && entries.length > 0 && !dateFrom && !dateTo && (
        <div className="flex gap-1.5 mb-2">
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors text-gray-600 border border-gray-800 hover:border-gray-700 hover:text-gray-400"
          >
            📅 日付絞込
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
                : "bg-[#16213e] text-gray-400 border border-gray-700"
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
                  : "bg-[#16213e] text-gray-400 border border-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* 記録フォーム */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4"
        >
          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
              {formError}
            </div>
          )}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-400 text-xs">日付</label>
              {form.date !== today && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, date: today })}
                  className="text-[10px] text-[#e94560] hover:text-[#c73652] font-medium"
                >
                  今日に戻す
                </button>
              )}
            </div>
            <input
              type="date"
              value={form.date}
              max={today}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
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
            <label className="block text-gray-400 text-xs mb-1">練習タイプ</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
            >
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 試合詳細フォーム（competition タイプ選択時のみ表示） */}
          {form.type === "competition" && (
            <div className="mb-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
              <p className="text-[11px] text-red-400 font-semibold mb-2">🏆 試合記録</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">結果</label>
                  <select
                    value={compForm.result}
                    onChange={(e) => setCompForm({ ...compForm, result: e.target.value })}
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-red-400"
                  >
                    <option value="win">勝利 🏆</option>
                    <option value="loss">敗北</option>
                    <option value="draw">引き分け</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">相手（任意）</label>
                  <input
                    type="text"
                    value={compForm.opponent}
                    onChange={(e) => setCompForm({ ...compForm, opponent: e.target.value })}
                    placeholder="相手の名前"
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-red-400 placeholder-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">フィニッシュ（任意）</label>
                  <input
                    type="text"
                    value={compForm.finish}
                    onChange={(e) => setCompForm({ ...compForm, finish: e.target.value })}
                    placeholder="例: ヒールフック"
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-red-400 placeholder-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">大会名（任意）</label>
                  <input
                    type="text"
                    value={compForm.event}
                    onChange={(e) => setCompForm({ ...compForm, event: e.target.value })}
                    placeholder="例: 東京オープン"
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-red-400 placeholder-gray-600"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-gray-400 text-xs mb-1">メモ</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="今日の練習のポイント、気づきなど..."
              rows={2}
              className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
            >
              {loading ? "保存中..." : "保存"}
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
          <div className="inline-block w-6 h-6 border-2 border-gray-600 border-t-[#e94560] rounded-full animate-spin mb-2" />
          <p className="text-sm">読み込み中...</p>
        </div>
      )}

      {/* 記録一覧 */}
      {!initialLoading && entries.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">🥋</div>
          <p className="text-gray-300 font-semibold mb-1">練習記録がまだありません</p>
          <p className="text-gray-500 text-sm mb-5">最初の練習を記録して、成長の旅を始めよう！</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#e94560] hover:bg-[#c73652] text-white text-sm font-semibold py-2.5 px-6 rounded-full transition-colors"
          >
            + 最初の練習を記録
          </button>
        </div>
      )}

      {!initialLoading && entries.length > 0 && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          {searchQuery ? `「${searchQuery}」に一致する記録はありません` : "このフィルターに一致する記録はありません"}
        </div>
      )}

      {!initialLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className={`bg-[#16213e] rounded-xl p-4 border border-gray-700${entry.type === "competition" ? " border-l-2 border-l-red-500" : ""}`}
            >
              {editingId === entry.id ? (
                /* インライン編集フォーム */
                <form onSubmit={(e) => handleUpdate(e, entry.id)}>
                  <div className="mb-2">
                    <input
                      type="date"
                      value={editForm.date}
                      max={today}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 mb-2"
                    />
                    <DurationPicker
                      value={editForm.duration_min}
                      onChange={(v) => setEditForm({ ...editForm, duration_min: v })}
                    />
                  </div>
                  <select
                    value={editForm.type}
                    onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 mb-2"
                  >
                    {TRAINING_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  {editForm.type === "competition" && (
                    <div className="mb-2 bg-red-500/5 border border-red-500/20 rounded-xl p-2 space-y-1.5">
                      <p className="text-[10px] text-red-400 font-semibold">🏆 試合詳細</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={editCompForm.result}
                          onChange={(e) => setEditCompForm({ ...editCompForm, result: e.target.value })}
                          className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1 text-xs border border-gray-600 focus:outline-none focus:border-red-400"
                        >
                          <option value="win">勝利 🏆</option>
                          <option value="loss">敗北</option>
                          <option value="draw">引き分け</option>
                        </select>
                        <input
                          type="text"
                          value={editCompForm.opponent}
                          onChange={(e) => setEditCompForm({ ...editCompForm, opponent: e.target.value })}
                          placeholder="対戦相手"
                          className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1 text-xs border border-gray-600 focus:outline-none focus:border-red-400 placeholder-gray-600"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="text"
                          value={editCompForm.finish}
                          onChange={(e) => setEditCompForm({ ...editCompForm, finish: e.target.value })}
                          placeholder="フィニッシュ技"
                          className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1 text-xs border border-gray-600 focus:outline-none focus:border-red-400 placeholder-gray-600"
                        />
                        <input
                          type="text"
                          value={editCompForm.event}
                          onChange={(e) => setEditCompForm({ ...editCompForm, event: e.target.value })}
                          placeholder="大会名"
                          className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1 text-xs border border-gray-600 focus:outline-none focus:border-red-400 placeholder-gray-600"
                        />
                      </div>
                    </div>
                  )}
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={2}
                    className="w-full bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-400 resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-[#e94560] text-white text-xs font-semibold py-1.5 rounded-lg">
                      更新
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="px-3 text-gray-400 text-xs">
                      キャンセル
                    </button>
                  </div>
                </form>
              ) : (
                /* 通常表示 */
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TRAINING_TYPES.find((t) => t.value === entry.type)?.color || "bg-gray-700 text-gray-300"}`}>
                        {TRAINING_TYPES.find((t) => t.value === entry.type)?.label || entry.type}
                      </span>
                      <span className="text-gray-400 text-xs">{entry.date}</span>
                    </div>
                    <div className="text-[#e94560] text-xs font-medium mb-1">
                      ⏱ {entry.duration_min >= 60
                        ? `${Math.floor(entry.duration_min / 60)}時間${entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}分` : ""}`
                        : `${entry.duration_min}分`}
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
                              {comp.opponent && <span className="text-xs text-gray-400">vs {comp.opponent}</span>}
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
                                    折りたたむ ▲
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
                                  もっと見る ▼
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
                      title="編集"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-gray-600 hover:text-red-400 transition-colors p-1 disabled:opacity-50"
                      title="削除"
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

      {/* もっと見るボタン */}
      {!initialLoading && hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="text-gray-400 hover:text-white text-sm border border-gray-700 hover:border-gray-500 px-6 py-2 rounded-full transition-colors disabled:opacity-50"
          >
            {loadingMore ? "読み込み中..." : "もっと見る"}
          </button>
        </div>
      )}
    </div>
  );
}

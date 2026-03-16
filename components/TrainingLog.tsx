"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Toast from "./Toast";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
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
        setEntries(data.slice(0, PAGE_SIZE));
      }
      setInitialLoading(false);
    };

    loadEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase
      .from("training_logs")
      .insert([{ ...form, user_id: userId }])
      .select()
      .single();

    if (!error && data) {
      setEntries([data, ...entries]);
      setForm({
        date: new Date().toISOString().split("T")[0],
        duration_min: 60,
        type: "gi",
        notes: "",
      });
      setShowForm(false);
      setToast({ message: "練習を記録しました！", type: "success" });
    } else {
      setToast({ message: "保存に失敗しました", type: "error" });
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
  };

  const handleUpdate = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from("training_logs")
      .update(editForm)
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

  // 今月の合計時間
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
  const monthTotalMins = monthEntries.reduce((sum, e) => sum + e.duration_min, 0);
  const monthHoursDisplay = monthTotalMins >= 60
    ? `${Math.floor(monthTotalMins / 60)}h${monthTotalMins % 60 > 0 ? `${monthTotalMins % 60}m` : ""}`
    : `${monthTotalMins}m`;
  const monthHours = Math.round(monthTotalMins / 60);

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      {/* 月次サマリー */}
      {!initialLoading && entries.length > 0 && (
        <div className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4">
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
              <div className="text-lg font-bold text-green-400">{entries.length}</div>
              <div className="text-gray-400 text-xs">総記録数</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">練習記録</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#e94560] hover:bg-[#c73652] text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          + 記録を追加
        </button>
      </div>

      {/* 記録フォーム */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#16213e] rounded-xl p-4 border border-gray-700 mb-4"
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-gray-400 text-xs mb-1">日付</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">時間（分）</label>
              <input
                type="number"
                value={form.duration_min}
                onChange={(e) =>
                  setForm({ ...form, duration_min: Number(e.target.value) })
                }
                min={1}
                max={480}
                className="w-full bg-[#0f3460] text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
                required
              />
            </div>
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
              onClick={() => setShowForm(false)}
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

      {!initialLoading && entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#16213e] rounded-xl p-4 border border-gray-700"
            >
              {editingId === entry.id ? (
                /* インライン編集フォーム */
                <form onSubmit={(e) => handleUpdate(e, entry.id)}>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      className="bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
                    />
                    <input
                      type="number"
                      value={editForm.duration_min}
                      onChange={(e) => setEditForm({ ...editForm, duration_min: Number(e.target.value) })}
                      min={1} max={480}
                      className="bg-[#0f3460] text-white rounded-lg px-2 py-1.5 text-sm border border-gray-600 focus:outline-none focus:border-blue-400"
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
                    {entry.notes && (
                      <p className="text-gray-300 text-sm mt-1">{entry.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3 flex-shrink-0">
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

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  { value: "gi", label: "道衣 (Gi)" },
  { value: "nogi", label: "ノーギ (No-Gi)" },
  { value: "drilling", label: "ドリル" },
  { value: "competition", label: "試合" },
  { value: "open_mat", label: "オープンマット" },
];

export default function TrainingLog({ userId }: Props) {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    duration_min: 60,
    type: "gi",
    notes: "",
  });
  const supabase = createClient();

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
    } else {
      alert("テーブルが未作成です。Supabaseでテーブルを作成してください。");
    }
    setLoading(false);
  };

  return (
    <div>
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
              <label className="block text-gray-400 text-xs mb-1">
                時間（分）
              </label>
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
            <label className="block text-gray-400 text-xs mb-1">
              練習タイプ
            </label>
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

      {/* 記録一覧 */}
      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📝</div>
          <p>練習記録がまだありません</p>
          <p className="text-sm mt-1">最初の記録を追加しましょう！</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-[#16213e] rounded-xl p-4 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm">
                  {TRAINING_TYPES.find((t) => t.value === entry.type)?.label ||
                    entry.type}
                </span>
                <span className="text-gray-400 text-xs">{entry.date}</span>
              </div>
              <div className="text-gray-400 text-xs mb-1">
                ⏱ {entry.duration_min}分
              </div>
              {entry.notes && (
                <p className="text-gray-300 text-sm">{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

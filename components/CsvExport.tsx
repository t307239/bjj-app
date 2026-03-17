"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TYPE_LABELS: Record<string, string> = {
  gi: "道着あり (Gi)",
  nogi: "道着なし (No-Gi)",
  drilling: "ドリル",
  competition: "試合",
  open_mat: "オープンマット",
};

type Props = {
  userId: string;
};

export default function CsvExport({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleExport = async () => {
    setLoading(true);

    const { data: logs, error } = await supabase
      .from("training_logs")
      .select("date, type, duration_min, notes, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error || !logs) {
      alert("エクスポートに失敗しました。もう一度お試しください。");
      setLoading(false);
      return;
    }

    const header = ["日付", "種類", "時間（分）", "メモ"];
    const rows = logs.map((l) => [
      l.date,
      TYPE_LABELS[l.type] ?? l.type,
      String(l.duration_min ?? ""),
      `"${(l.notes ?? "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");

    // BOM付きUTF-8でExcelでも文字化けなし
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;

    const a = document.createElement("a");
    a.href = url;
    a.download = `bjj_training_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setLoading(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
      title="練習記録をCSV形式でダウンロード"
    >
      {loading ? (
        <>
          <div className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
          <span>エクスポート中...</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>CSV出力</span>
        </>
      )}
    </button>
  );
}

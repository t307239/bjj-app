"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
};

const TRAINING_TYPE_LABELS: Record<string, string> = {
  gi: "道衣 (Gi)",
  nogi: "ノーギ",
  drilling: "ドリル",
  competition: "試合",
  open_mat: "オープンマット",
};

function decodeCompForCsv(notes: string): string {
  const PREFIX = "__comp__";
  if (!notes.startsWith(PREFIX)) return notes;
  try {
    const body = notes.slice(PREFIX.length);
    const nlIdx = body.indexOf("\n");
    const jsonStr = nlIdx >= 0 ? body.slice(0, nlIdx) : body;
    const userNotes = nlIdx >= 0 ? body.slice(nlIdx + 1) : "";
    const comp = JSON.parse(jsonStr);
    const LABELS: Record<string, string> = { win: "勝利", loss: "敗北", draw: "引き分け" };
    const label = LABELS[comp.result as string] ?? comp.result ?? "";
    const parts: string[] = [label];
    if (comp.opponent) parts.push("vs " + comp.opponent);
    if (comp.finish) parts.push("by " + comp.finish);
    if (comp.event) parts.push(String(comp.event));
    if (userNotes) parts.push(userNotes);
    return parts.join(" | ");
  } catch { return notes; }
}

export default function CsvExport({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: logs, error } = await supabase
        .from("training_logs")
        .select("date, type, duration_min, notes")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (error || !logs) {
        alert("エクスポートに失敗しました");
        return;
      }

      const headers = ["日付", "タイプ", "時間(分)", "メモ"];
      const rows = logs.map((l: { date: string; type: string; duration_min: number; notes: string }) => [
        l.date,
        TRAINING_TYPE_LABELS[l.type] ?? l.type,
        l.duration_min ?? "",
        decodeCompForCsv(l.notes ?? "").replace(/"/g, '""'),
      ]);

      const csvContent =
        "\uFEFF" +
        [headers, ...rows]
          .map((row) => row.map((cell) => `"${cell}"`).join(","))
          .join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bjj_training_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      title="練習記録をCSVでダウンロード"
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {loading ? "出力中..." : "CSV出力"}
    </button>
  );
}

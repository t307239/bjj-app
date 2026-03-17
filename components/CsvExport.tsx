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

const MASTERY_LABELS: Record<number, string> = {
  1: "入門", 2: "基礎", 3: "中級", 4: "上級", 5: "マスター",
};

// 試合詳細デコード（TrainingLog.tsx と同一ロジック）
const COMP_PREFIX = "__comp__";
type CompData = { result: string; opponent: string; finish: string; event: string };

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

const RESULT_LABELS: Record<string, string> = {
  win: "勝利", loss: "敗北", draw: "引き分け",
};

// ExportBtn サブコンポーネント
function ExportBtn({
  label,
  onClick,
  loading,
}: {
  label: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {loading ? "出力中..." : label}
    </button>
  );
}

export default function CsvExport({ userId }: Props) {
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingTech, setLoadingTech] = useState(false);
  const supabase = createClient();

  const handleExport = async () => {
    setLoadingLogs(true);
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

      // 試合詳細を含む拡張ヘッダc��
      const headers = ["日付", "タイプ", "時間(分)", "試合結果", "対戦相手", "決め技", "大会名", "メモ"];
      const rows = logs.map((l: { date: string; type: string; duration_min: number; notes: string }) => {
        const { comp, userNotes } = decodeCompNotes(l.notes ?? "");
        return [
          l.date,
          TRAINING_TYPE_LABELS[l.type] ?? l.type,
          l.duration_min ?? "",
          // 試合詳細（非試合エントリは空欄）
          comp ? (RESULT_LABELS[comp.result] ?? comp.result) : "",
          comp ? (comp.opponent ?? "") : "",
          comp ? (comp.finish ?? "") : "",
          comp ? (comp.event ?? "") : "",
          (userNotes ?? "").replace(/"/g, '""'),
        ];
      });

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
      setLoadingLogs(false);
    }
  };

  const handleExportTechniques = async () => {
    setLoadingTech(true);
    try {
      const { data: techs, error } = await supabase
        .from("techniques")
        .select("name, category, mastery_level, notes")
        .eq("user_id", userId)
        .order("name");

      if (error || !techs) {
        alert("エクスポートに失敗しました");
        return;
      }

      const headers = ["テクニック名", "カテゴリ", "習熟度", "メモ"];
      const rows = techs.map((t: { name: string; category: string; mastery_level: number; notes: string }) => [
        t.name ?? "",
        t.category ?? "",
        MASTERY_LABELS[t.mastery_level] ?? String(t.mastery_level ?? ""),
        (t.notes ?? "").replace(/"/g, '""'),
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
      a.download = `bjj_techniques_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setLoadingTech(false);
    }
  };

  return (
    <div className="flex gap-2">
      <ExportBtn label="CSV出力" onClick={handleExport} loading={loadingLogs} />
      <ExportBtn label="技術CSV" onClick={handleExportTechniques} loading={loadingTech} />
    </div>
  );
}

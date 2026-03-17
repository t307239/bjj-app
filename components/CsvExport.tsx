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

const MASTERY_LABELS: Record<number, string> = {
  1: "入門", 2: "基礎", 3: "中級", 4: "上級", 5: "ヮスター",
};

// 試合ノートのデコード（TrainingLogと同じロジック）
const COMP_PREFIX = "__comp__";
const RESULT_MAP: Record<string, string> = { win: "勝利", loss: "敗北", draw: "引き分け" };

function decodeCompForCsv(notes: string): string {
  if (!notes || !notes.startsWith(COMP_PREFIX)) return notes;
  const nl = notes.indexOf("\n");
  const jsonStr = nl === -1 ? notes.slice(COMP_PREFIX.length) : notes.slice(COMP_PREFIX.length, nl);
  const userNotes = nl === -1 ? "" : notes.slice(nl + 1);
  try {
    const comp = JSON.parse(jsonStr) as { result: string; opponent: string; finish: string; event: string };
    const parts = [RESULT_MAP[comp.result] ?? comp.result];
    if (comp.opponent) parts.push("vs " + comp.opponent);
    if (comp.finish) parts.push("by " + comp.finish);
    if (comp.event) parts.push(comp.event);
    const compStr = parts.join(" | ");
    return userNotes ? compStr + " / " + userNotes : compStr;
  } catch {
    return notes;
  }
}

type Props = {
  userId: string;
};

export default function CsvExport({ userId }: Props) {
  const [loadingLog, setLoadingLog] = useState(false);
  const [loadingTech, setLoadingTech] = useState(false);
  const supabase = createClient();

  const getDateStr = () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  };

  const downloadCsv = (content: string, filename: string) => {
    const bom = "\uFEFF";
    const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportLog = async () => {
    setLoadingLog(true);

    const { data: logs, error } = await supabase
      .from("training_logs")
      .select("date, type, duration_min, notes, created_at")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (error || !logs) {
      alert("エクスポートに失敗しました。もう一度お試しください。");
      setLoadingLog(false);
      return;
    }

    // CSV生成
    const header = ["日付", "種類", "時間（分）", "メモ"];
    const rows = logs.map((l) => [
      l.date,
      TYPE_LABELS[l.type] ?? l.type,
      String(l.duration_min ?? ""),
      `"${decodeCompForCsv(l.notes ?? "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsv(csvContent, `bjj_training_${getDateStr()}.csv`);
    setLoadingLog(false);
  };

  const handleExportTechniques = async () => {
    setLoadingTech(true);

    const { data: techniques, error } = await supabase
      .from("techniques")
      .select("name, category, mastery_level, notes")
      .eq("user_id", userId)
      .order("name", { ascending: true });

    if (error || !techniques) {
      alert("エクスポートに失敗しました。もう一度お試しください。");
      setLoadingTech(false);
      return;
    }

    const header = ["テクニック名", "カテゴリ", "習熟度", "メモ"];
    const rows = techniques.map((t) => [
      `"${(t.name ?? "").replace(/"/g, '""')}"`,
      `"${(t.category ?? "").replace(/"/g, '""')}"`,
      MASTERY_LABELS[t.mastery_level as number] ?? String(t.mastery_level ?? ""),
      `"${(t.notes ?? "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCsv(csvContent, `bjj_techniques_${getDateStr()}.csv`);
    setLoadingTech(false);
  };

  const ExportBtn = ({
    onClick, loading, label, title,
  }: { onClick: () => void; loading: boolean; label: string; title: string }) => (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
      title={title}
    >
      {loading ? (
        <>
          <div className="w-3 h-3 border border-gray-500 border-t-white rounded-full animate-spin" />
          <span>出力中</span>
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="flex items-center gap-1.5">
      <ExportBtn
        onClick={handleExportLog}
        loading={loadingLog}
        label="CSV"
        title="練習記録をCSV形式でダウンロード"
      />
      <ExportBtn
        onClick={handleExportTechniques}
        loading={loadingTech}
        label="技術CSV"
        title="テクニック一覧をCSV形式でダウンロード"
      />
    </div>
  );
}

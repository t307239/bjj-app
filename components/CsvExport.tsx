"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
// ProGate import removed — CSV is now free for all users (CCPA/GDPR data portability)

type Props = {
  userId: string;
  isPro?: boolean; // kept for API compatibility but no longer used to gate export
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

// ExportBtn サブコンポーネント
function ExportBtn({
  label,
  loadingLabel,
  onClick,
  loading,
}: {
  label: string;
  loadingLabel: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? (
        <span className="inline-block w-3 h-3 border border-white/10 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {loading ? loadingLabel : label}
    </button>
  );
}

export default function CsvExport({ userId }: Props) {
  const { t } = useLocale();
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
        alert(t("csv.exportFailed"));
        return;
      }

      // 試合詳細を含む拡張ヘッダー
      const headers = [
        t("csv.header.date"),
        t("csv.header.type"),
        t("csv.header.duration"),
        t("csv.header.result"),
        t("csv.header.opponent"),
        t("csv.header.finish"),
        t("csv.header.event"),
        t("csv.header.notes"),
      ];

      // Get training type labels from i18n
      const typeLabels: Record<string, string> = {
        gi: t("training.gi"),
        nogi: t("training.nogi"),
        drilling: t("training.drilling"),
        competition: t("training.competition"),
        open_mat: t("training.open_mat"),
      };

      const resultLabels: Record<string, string> = {
        win: t("training.competition"),
        loss: t("csv.loss"),
        draw: t("csv.draw"),
      };

      const rows = logs.map((l: { date: string; type: string; duration_min: number; notes: string }) => {
        const { comp, userNotes } = decodeCompNotes(l.notes ?? "");
        return [
          l.date,
          typeLabels[l.type] ?? l.type,
          l.duration_min ?? "",
          // 試合詳細（非試合エントリは空欄）
          comp ? (resultLabels[comp.result] ?? comp.result) : "",
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
        alert(t("csv.exportFailed"));
        return;
      }

      const headers = [
        t("csv.header.techName"),
        t("csv.header.category"),
        t("csv.header.mastery"),
        t("csv.header.notes"),
      ];

      const masteryLabels: Record<number, string> = {
        1: t("techniques.mastery1"),
        2: t("techniques.mastery2"),
        3: t("techniques.mastery3"),
        4: t("techniques.mastery4"),
        5: t("techniques.mastery5"),
      };

      const rows = techs.map((t: { name: string; category: string; mastery_level: number; notes: string }) => [
        t.name ?? "",
        t.category ?? "",
        masteryLabels[t.mastery_level] ?? String(t.mastery_level ?? ""),
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

  // CCPA/GDPR: data portability is a legal right for ALL users, not Pro-only.
  // Do NOT gate CSV export behind isPro — all users must be able to export their data.
  // (isPro prop kept for potential future use but no longer used here)

  return (
    <div className="flex gap-2">
      <ExportBtn label={t("csv.button.training")} loadingLabel={t("common.loading")} onClick={handleExport} loading={loadingLogs} />
      <ExportBtn label={t("csv.button.techniques")} loadingLabel={t("common.loading")} onClick={handleExportTechniques} loading={loadingTech} />
    </div>
  );
}

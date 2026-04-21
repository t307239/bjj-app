"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { decodeCompNotes } from "@/lib/trainingLogHelpers";
import { trackEvent } from "@/lib/analytics";
// ProGate import removed — CSV is now free for all users (CCPA/GDPR data portability)

type Props = {
  userId: string;
  isPro?: boolean; // kept for API compatibility but no longer used to gate export
};

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
    <button type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 hover:border-white/20 px-3 py-2.5 min-h-[44px] rounded-lg transition-colors disabled:opacity-50"
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
  const { t, locale } = useLocale();
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingTech, setLoadingTech] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

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
        win: t("csv.win"),
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
      trackEvent("csv_export_used", { type: "training_logs" });
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
      trackEvent("csv_export_used", { type: "techniques" });
    } finally {
      setLoadingTech(false);
    }
  };

  // ── PDF export (training logs) ────────────────────────────────────────────
  const handleExportPdf = async () => {
    setLoadingPdf(true);
    try {
      const { data: logs, error } = await supabase
        .from("training_logs")
        .select("date, type, duration_min, notes")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (error || !logs || logs.length === 0) {
        alert(logs?.length === 0 ? t("csv.pdfNoData") : t("csv.exportFailed"));
        return;
      }

      const typeLabels: Record<string, string> = {
        gi: t("training.gi"),
        nogi: t("training.nogi"),
        drilling: t("training.drilling"),
        competition: t("training.competition"),
        open_mat: t("training.open_mat"),
      };

      const resultLabels: Record<string, string> = {
        win: t("csv.win"),
        loss: t("csv.loss"),
        draw: t("csv.draw"),
      };

      // Summary stats
      const totalSessions = logs.length;
      const totalMinutes = logs.reduce(
        (sum: number, l: { duration_min: number }) => sum + (l.duration_min ?? 0),
        0,
      );
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
      const dates = logs.map((l: { date: string }) => l.date).filter(Boolean).sort();
      const dateFrom = dates[0] ?? "";
      const dateTo = dates[dates.length - 1] ?? "";
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      // Build table rows
      const tableRows = logs
        .map((l: { date: string; type: string; duration_min: number; notes: string }) => {
          const { comp, userNotes } = decodeCompNotes(l.notes ?? "");
          const result = comp ? (resultLabels[comp.result] ?? comp.result) : "";
          const escapedNotes = (userNotes ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          return `<tr>
          <td>${l.date}</td>
          <td>${typeLabels[l.type] ?? l.type}</td>
          <td style="text-align:right">${l.duration_min ?? ""}</td>
          <td>${result}</td>
          <td>${escapedNotes}</td>
        </tr>`;
        })
        .join("");

      const htmlContent = `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<title>${t("csv.pdfTitle")} — BJJ App</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
    color: #1a1a2e; background: #fff; font-size: 11px; line-height: 1.5;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #e94560; padding-bottom: 10px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
  .header .sub { font-size: 10px; color: #64748b; }
  .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
  .stat-label { font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
  .stat-unit { font-size: 10px; color: #64748b; margin-left: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.3px; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .hint { text-align: center; margin-bottom: 12px; padding: 8px; background: #eff6ff; border-radius: 6px; font-size: 10px; color: #3b82f6; }
  @media print { .hint { display: none; } }
</style>
</head>
<body>
  <div class="hint">💡 ${t("csv.pdfPrintHint")}</div>
  <div class="header">
    <div>
      <h1>${t("csv.pdfTitle")}</h1>
      <div class="sub">${t("csv.pdfSubtitle")}</div>
    </div>
    <div class="sub">${t("csv.pdfGenerated")}: ${today}</div>
  </div>
  <div class="summary">
    <div class="stat">
      <div class="stat-label">${t("csv.pdfTotalSessions")}</div>
      <div class="stat-value">${totalSessions}<span class="stat-unit">${t("csv.pdfSessions")}</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">${t("csv.pdfTotalHours")}</div>
      <div class="stat-value">${totalHours}<span class="stat-unit">${t("csv.pdfHours")}</span></div>
    </div>
    <div class="stat">
      <div class="stat-label">${t("csv.pdfDateRange")}</div>
      <div class="stat-value" style="font-size:12px">${dateFrom} ${t("csv.pdfTo")} ${dateTo}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${t("csv.header.date")}</th>
        <th>${t("csv.header.type")}</th>
        <th style="text-align:right">${t("csv.header.duration")}</th>
        <th>${t("csv.header.result")}</th>
        <th>${t("csv.header.notes")}</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">BJJ App — bjj-app.net</div>
  <script>window.onload=function(){window.print();}</script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Clean up after a delay to allow the new tab to load
      const tid = setTimeout(() => URL.revokeObjectURL(url), 60000);
      // No cleanup needed for this component-level timeout — it's a one-shot fire-and-forget
      void tid;
    } finally {
      setLoadingPdf(false);
    }
  };

  // CCPA/GDPR: data portability is a legal right for ALL users, not Pro-only.
  // Do NOT gate CSV export behind isPro — all users must be able to export their data.
  // (isPro prop kept for potential future use but no longer used here)

  return (
    <div className="flex gap-2 flex-wrap">
      <ExportBtn label={t("csv.button.training")} loadingLabel={t("common.loading")} onClick={handleExport} loading={loadingLogs} />
      <ExportBtn label={t("csv.button.techniques")} loadingLabel={t("common.loading")} onClick={handleExportTechniques} loading={loadingTech} />
      <ExportBtn label={t("csv.button.pdf")} loadingLabel={t("common.loading")} onClick={handleExportPdf} loading={loadingPdf} />
    </div>
  );
}

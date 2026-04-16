"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { type Gym } from "./types";

type Props = {
  gym: Gym;
  onUpgradeClick: () => void;
  upgrading: boolean;
  isGymPro: boolean;
};

export default function CsvBulkInvite({ gym, onUpgradeClick, upgrading, isGymPro }: Props) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [rows, setRows] = useState<{ email: string; name: string }[]>([]);
  const [parsed, setParsed] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const copiedIdxTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const copiedAllTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (copiedIdxTimerRef.current) clearTimeout(copiedIdxTimerRef.current);
      if (copiedAllTimerRef.current) clearTimeout(copiedAllTimerRef.current);
    };
  }, []);

  const inviteBase =
    typeof window !== "undefined"
      ? `${window.location.origin}/gym/join/${gym.invite_code}`
      : `https://bjj-app.net/gym/join/${gym.invite_code}`;

  const parseInput = () => {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const result: { email: string; name: string }[] = [];
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes("email");
    const startIdx = hasHeader ? 1 : 0;

    let emailCol = 0;
    let nameCol = -1;
    if (hasHeader) {
      const cols = firstLine.split(",").map((c) => c.trim());
      emailCol = cols.findIndex((c) => c.includes("email"));
      nameCol = cols.findIndex((c) => c.includes("name") || c.includes("student") || c.includes("athlete"));
      if (emailCol < 0) emailCol = 0;
    }

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(",")) {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const email = cols[emailCol] ?? "";
        const name = nameCol >= 0 ? (cols[nameCol] ?? "") : "";
        if (email.includes("@")) result.push({ email, name });
      } else {
        const email = line.trim();
        if (email.includes("@")) result.push({ email, name: "" });
      }
    }

    setRows(result);
    setParsed(true);
  };

  const copyLink = async (idx: number) => {
    try {
      await navigator.clipboard.writeText(inviteBase);
      setCopiedIdx(idx);
      copiedIdxTimerRef.current = setTimeout(() => setCopiedIdx(null), 2000);
    } catch {/* ignore */}
  };

  const copyAll = async () => {
    const text = rows
      .map((r) =>
        r.name ? `${r.name} (${r.email}): ${inviteBase}` : `${r.email}: ${inviteBase}`
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      copiedAllTimerRef.current = setTimeout(() => setCopiedAll(false), 2000);
    } catch {/* ignore */}
  };

  const downloadCsv = () => {
    const header = "name,email,invite_link,status\n";
    const body = rows
      .map((r) => `"${r.name}","${r.email}","${inviteBase}","pending"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${gym.name.replace(/\s+/g, "_")}_invites.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setInput("");
    setRows([]);
    setParsed(false);
    setCopiedIdx(null);
    setCopiedAll(false);
  };

  if (!isGymPro) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-xl flex-shrink-0">📥</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{t("gym.csvTitle")}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{t("gym.csvProRequired")}</p>
          </div>
          <button
            onClick={onUpgradeClick}
            disabled={upgrading}
            className="flex-shrink-0 bg-yellow-500 hover:bg-yellow-400 active:scale-95 disabled:opacity-60 text-black text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            {upgrading ? "..." : t("gym.upgradeBtn")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">📥 {t("gym.csvTitle")}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{t("gym.csvDesc")}</p>
          </div>
          <button
            onClick={() => { setOpen(true); reset(); }}
            className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            {t("gym.csvOpen")}
          </button>
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-8 pb-4 bg-black/70 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
              <h2 className="text-base font-bold text-white">📥 {t("gym.csvTitle")}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
                aria-label={t("common.close")}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              {!parsed ? (
                <>
                  <p className="text-xs text-zinc-400 mb-3">{t("gym.csvInstructions")}</p>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t("gym.csvPlaceholder")}
                    rows={8}
                    className="w-full bg-zinc-800 text-xs text-gray-200 placeholder-gray-600 px-3 py-2.5 rounded-lg border border-white/10 focus:outline-none focus:border-white/30 resize-none font-mono"
                  />
                  <button
                    onClick={parseInput}
                    disabled={!input.trim()}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {t("gym.csvParse")}
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-zinc-400">
                      {t("gym.csvResult", { n: rows.length })}
                    </p>
                    <button
                      onClick={reset}
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      {t("gym.csvReset")}
                    </button>
                  </div>

                  {/* Results table */}
                  <div className="max-h-60 overflow-y-auto space-y-1.5 mb-4">
                    {rows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
                        <div className="flex-1 min-w-0">
                          {row.name && (
                            <p className="text-xs font-medium text-white truncate">{row.name}</p>
                          )}
                          <p className="text-xs text-zinc-400 truncate">{row.email}</p>
                        </div>
                        <button
                          onClick={() => copyLink(idx)}
                          className="flex-shrink-0 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          {copiedIdx === idx ? t("gym.inviteCopied") : t("gym.inviteCopy")}
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Bulk actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={copyAll}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      {copiedAll ? t("gym.csvCopiedAll") : t("gym.csvCopyAll")}
                    </button>
                    <button
                      onClick={downloadCsv}
                      className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      {t("gym.csvDownload")}
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 mt-3 text-center">
                    {t("gym.csvNote")}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

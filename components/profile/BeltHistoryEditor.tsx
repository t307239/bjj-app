"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { getLocalDateString } from "@/lib/timezone";

const BELT_ORDER = ["white", "blue", "purple", "brown", "black"] as const;
const BELT_COLORS: Record<string, string> = {
  white: "bg-white text-gray-900",
  blue: "bg-blue-500 text-white",
  purple: "bg-purple-600 text-white",
  brown: "bg-amber-800 text-white",
  black: "bg-zinc-950 text-white border border-white/10",
};

type BeltHistoryEntry = {
  belt: string;
  promoted_at: string;
  notes: string;
};

type Props = {
  userId: string;
  externalExpanded?: boolean;
};

export default function BeltHistoryEditor({ userId, externalExpanded }: Props) {
  const { t } = useLocale();
  const [entries, setEntries] = useState<BeltHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = externalExpanded || internalExpanded;
  const setExpanded = (v: boolean) => setInternalExpanded(v);
  const [showAdd, setShowAdd] = useState(false);
  const [newBelt, setNewBelt] = useState("");
  const [newDate, setNewDate] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const today = getLocalDateString();

  const supabase = createClient();

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("belt_history")
        .select("belt, promoted_at, notes")
        .eq("user_id", userId)
        .order("promoted_at", { ascending: true });
      setEntries((data as BeltHistoryEntry[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [userId, supabase]);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  const BELT_LABELS: Record<string, string> = {
    white: t("dashboard.beltWhite"),
    blue: t("dashboard.beltBlue"),
    purple: t("dashboard.beltPurple"),
    brown: t("dashboard.beltBrown"),
    black: t("dashboard.beltBlack"),
  };

  // Which belts are not yet in history
  const existingBelts = new Set(entries.map((e) => e.belt));
  const availableBelts = BELT_ORDER.filter((b) => !existingBelts.has(b));

  const handleAdd = async () => {
    if (!newBelt || !newDate) return;
    setSaving(true);
    const { error } = await supabase.from("belt_history").upsert(
      { user_id: userId, belt: newBelt, promoted_at: newDate },
      { onConflict: "user_id,belt" }
    );
    if (!error) {
      setEntries((prev) =>
        [...prev, { belt: newBelt, promoted_at: newDate, notes: "" }].sort(
          (a, b) => BELT_ORDER.indexOf(a.belt as typeof BELT_ORDER[number]) - BELT_ORDER.indexOf(b.belt as typeof BELT_ORDER[number])
        )
      );
      setNewBelt("");
      setNewDate("");
      setShowAdd(false);
      setToast(t("profile.saved"));
      toastTimer.current = setTimeout(() => setToast(null), 2000);
    }
    setSaving(false);
  };

  const handleDelete = async (belt: string) => {
    const { error } = await supabase
      .from("belt_history")
      .delete()
      .eq("user_id", userId)
      .eq("belt", belt);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.belt !== belt));
    }
  };

  const handleDateChange = async (belt: string, newDateValue: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("belt_history")
      .update({ promoted_at: newDateValue })
      .eq("user_id", userId)
      .eq("belt", belt);
    if (!error) {
      setEntries((prev) =>
        prev.map((e) => (e.belt === belt ? { ...e, promoted_at: newDateValue } : e))
      );
      setToast(t("profile.saved"));
      toastTimer.current = setTimeout(() => setToast(null), 2000);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-4 animate-pulse h-24" />
    );
  }

  // Collapsed: show a minimal toggle bar
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full flex items-center justify-between bg-zinc-900/30 hover:bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] rounded-xl px-4 py-2.5 transition-colors group"
      >
        <span className="text-xs font-semibold text-zinc-500 tracking-widest">
          {t("beltProgress.historyTitle")}
        </span>
        <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
          {t("beltProgress.editHistory")}
        </span>
      </button>
    );
  }

  return (
    <div className="bg-zinc-900/50 ring-1 ring-inset ring-white/[0.04] shadow-lg shadow-black/40 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-zinc-500 tracking-widest">
          {t("beltProgress.historyTitle")}
        </h3>
        <div className="flex items-center gap-2">
          {availableBelts.length > 0 && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5"
            >
              {showAdd ? t("training.cancel") : `+ ${t("beltProgress.addPromotion")}`}
            </button>
          )}
          <button
            onClick={() => { setExpanded(false); setShowAdd(false); }}
            className="text-xs text-zinc-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="mb-2 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
          ✓ {toast}
        </div>
      )}

      {/* Existing entries */}
      {entries.length === 0 ? (
        <p className="text-xs text-zinc-500">{t("beltProgress.noHistory")}</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.belt} className="flex items-center gap-3 group">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${BELT_COLORS[entry.belt] ?? ""}`}
              >
                {BELT_LABELS[entry.belt] ?? entry.belt}
              </span>
              <input
                type="date"
                value={entry.promoted_at}
                max={today}
                onChange={(e) => handleDateChange(entry.belt, e.target.value)}
                className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1.5 border border-white/8 focus:outline-none focus:border-white/20 flex-1 min-w-0"
              />
              <button
                onClick={() => handleDelete(entry.belt)}
                className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                title={t("training.delete")}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {availableBelts.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setNewBelt(b)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${BELT_COLORS[b]} ${
                  newBelt === b ? "ring-2 ring-white/60 scale-105" : "opacity-50 hover:opacity-80"
                }`}
              >
                {BELT_LABELS[b]}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={newDate}
            max={today}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full bg-zinc-800 text-zinc-300 text-sm rounded-lg px-3 py-2 border border-white/8 focus:outline-none focus:border-white/20"
          />
          <button
            onClick={handleAdd}
            disabled={!newBelt || !newDate || saving}
            className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-semibold py-2 rounded-lg border border-emerald-400/20 transition-all disabled:opacity-30"
          >
            {saving ? "..." : t("beltProgress.savePromotion")}
          </button>
        </div>
      )}
    </div>
  );
}

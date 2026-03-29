"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

interface Props {
  userId: string;
  onLogged?: () => void; // callback to refresh WeightChart
}

export default function QuickWeightLog({ userId, onLogged }: Props) {
  const { t } = useLocale();
  const isOnline = useOnlineStatus();
  const supabase = createClient();

  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 500) return;

    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("weight_logs").insert([{
      user_id: userId,
      weight: w,
      measured_at: now,
      note: note.trim() || null,
    }]);
    setSaving(false);

    if (error) {
      setToast(t("body.saveError"));
    } else {
      setWeight("");
      setNote("");
      setToast(t("body.saved"));
      onLogged?.();
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-white/10">
      <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wide">
        {t("body.quickLog")}
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block text-gray-400 text-xs mb-1">{t("body.weightKg")}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="20"
              max="500"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="75.5"
              required
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-600"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !isOnline || !weight}
            className="px-4 py-2 rounded-lg bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white text-sm font-semibold transition-all active:scale-95 whitespace-nowrap"
          >
            {saving ? t("body.saving") : t("body.logWeight")}
          </button>
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-1">{t("body.note")}</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("body.notePlaceholder")}
            maxLength={80}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-600"
          />
        </div>
      </form>

      {toast && (
        <div className="mt-2 text-xs text-center text-green-400 font-medium">{toast}</div>
      )}
    </div>
  );
}

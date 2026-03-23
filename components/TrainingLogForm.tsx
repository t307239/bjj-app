"use client";

import { useRef, useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { type CompData, BELT_RANKS } from "@/lib/trainingLogHelpers";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];

type FormState = {
  date: string;
  duration_min: number;
  type: string;
  notes: string;
};

// ── DurationPicker (inline — extracted from TrainingLog) ─────────────────────
function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const { t } = useLocale();
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{t("training.duration")}</label>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {DURATION_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
              value === p
                ? "bg-[#10B981] border-[#10B981] text-white"
                : "bg-zinc-800 border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            {p >= 60 ? `${p / 60}h` : `${p}m`}
          </button>
        ))}
      </div>
      <input
        type="number"
        value={value}
        min={1}
        max={480}
        onChange={(e) => onChange(parseInt(e.target.value) || 60)}
        className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
        placeholder={t("training.customMinutes")}
      />
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────
type Props = {
  showForm: boolean;
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  formError: string | null;
  today: string;
  onClose: () => void;
  compForm: CompData;
  setCompForm: (f: CompData) => void;
  techniqueSuggestions?: string[];
};

// ── Component ────────────────────────────────────────────────────────────────
export default function TrainingLogForm({
  showForm,
  form,
  setForm,
  onSubmit,
  loading,
  formError,
  today,
  onClose,
  compForm,
  setCompForm,
  techniqueSuggestions = [],
}: Props) {
  const { t } = useLocale();
  const techniqueInputRef = useRef<HTMLInputElement>(null);

  // Warn user if they try to leave with meaningful unsaved form data (notes only)
  const hasInput = form.notes.trim() !== "";
  useEffect(() => {
    if (!showForm || !hasInput) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [showForm, hasInput]);

  // Append selected technique tag to notes, then clear the input
  const handleTechniqueSelect = (value: string) => {
    if (!value.trim()) return;
    const tag = value.trim();
    const current = form.notes.trim();
    setForm({ ...form, notes: current ? `${current} | ${tag}` : tag });
    // Clear the technique input
    if (techniqueInputRef.current) techniqueInputRef.current.value = "";
  };

  if (!showForm) return null;

  return (
    <form
      onSubmit={onSubmit}
      className="bg-zinc-900 rounded-xl p-4 border border-white/10 mb-4"
    >
      {formError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
          {formError}
        </div>
      )}

      {/* Date */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <label className="text-gray-400 text-xs">{t("training.date")}</label>
          {form.date !== today && (
            <button
              type="button"
              onClick={() => setForm({ ...form, date: today })}
              className="text-[10px] text-gray-500 hover:text-white font-medium"
            >
              {t("training.backToToday")}
            </button>
          )}
        </div>
        <input
          type="date"
          value={form.date}
          max={today}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
          required
        />
      </div>

      {/* Duration */}
      <div className="mb-3">
        <DurationPicker
          value={form.duration_min}
          onChange={(v) => setForm({ ...form, duration_min: v })}
        />
      </div>

      {/* Type — large tappable tiles (fat-finger friendly) */}
      <div className="mb-3">
        <label className="block text-gray-400 text-xs mb-2">{t("training.typeShort")}</label>
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
          {TRAINING_TYPES.map((tt) => {
            const active = form.type === tt.value;
            return (
              <button
                key={tt.value}
                type="button"
                onClick={() => setForm({ ...form, type: tt.value })}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                  active
                    ? "bg-[#10B981]/15 border-[#10B981]/60 text-[#10B981] shadow-sm shadow-[#10B981]/20"
                    : "bg-zinc-800/60 border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="text-xl leading-none">{tt.icon}</span>
                <span className="leading-none text-[11px]">{tt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Competition details */}
      {form.type === "competition" && (
        <div className="mb-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
          <p className="text-[11px] text-red-400 font-semibold mb-2">{t("competition.formHeader")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.result")}</label>
              <select
                value={compForm.result}
                onChange={(e) => setCompForm({ ...compForm, result: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              >
                <option value="win">{t("csv.win")} 🏆</option>
                <option value="loss">{t("csv.loss")}</option>
                <option value="draw">{t("csv.draw")}</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.opponent")} (optional)</label>
              <input
                type="text"
                value={compForm.opponent}
                onChange={(e) => setCompForm({ ...compForm, opponent: e.target.value })}
                placeholder={t("competition.opponentPlaceholder")}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.finish")} (optional)</label>
              <input
                type="text"
                value={compForm.finish}
                onChange={(e) => setCompForm({ ...compForm, finish: e.target.value })}
                placeholder={t("competition.finishPlaceholder")}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.event")} (optional)</label>
              <input
                type="text"
                value={compForm.event}
                onChange={(e) => setCompForm({ ...compForm, event: e.target.value })}
                placeholder={t("competition.eventPlaceholder")}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.opponentBelt")} (optional)</label>
              <select
                value={compForm.opponent_rank}
                onChange={(e) => setCompForm({ ...compForm, opponent_rank: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              >
                {BELT_RANKS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.giType")}</label>
              <select
                value={compForm.gi_type}
                onChange={(e) => setCompForm({ ...compForm, gi_type: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-white/10 focus:outline-none focus:border-white/30"
              >
                <option value="gi">{t("training.gi")}</option>
                <option value="nogi">{t("training.nogi")}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Technique autocomplete (Phase 2.5 minimum: datalist from technique_nodes) */}
      {techniqueSuggestions.length > 0 && (
        <div className="mb-3">
          <label className="block text-gray-400 text-xs mb-1">{t("competition.quickTechniqueTag")}</label>
          <input
            ref={techniqueInputRef}
            type="text"
            list="technique-autocomplete-list"
            placeholder={t("competition.searchTechniquesPlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleTechniqueSelect((e.target as HTMLInputElement).value); } }}
            onChange={(e) => {
              // Auto-select when exact match found in datalist
              const val = e.target.value;
              if (techniqueSuggestions.includes(val)) handleTechniqueSelect(val);
            }}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 placeholder-gray-500"
          />
          <datalist id="technique-autocomplete-list">
            {techniqueSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className="text-[10px] text-gray-600 mt-0.5">{t("competition.techAppendNote")}</p>
        </div>
      )}

      {/* Notes */}
      <div className="mb-4">
        <label className="block text-gray-400 text-xs mb-1">{t("training.memo")}</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder={t("training.memoFormPlaceholder")}
          rows={2}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-all"
        >
          {loading ? t("training.saving") : t("training.save")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          {t("training.cancel")}
        </button>
      </div>
    </form>
  );
}

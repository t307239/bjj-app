"use client";

import { useRef, useEffect, useState, memo } from "react";
import { useLocale } from "@/lib/i18n";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { type CompData, BELT_RANKS } from "@/lib/trainingLogHelpers";
import BottomSheet from "@/components/ui/BottomSheet";
import { getYesterdayDateString } from "@/lib/timezone";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 150, 180];

// ── Roll Focus themes ────────────────────────────────────────────────────────
const ROLL_FOCUS_OPTIONS = [
  { value: "flow",       i18nKey: "training.rollFocusFlow",       emoji: "🌊" },
  { value: "positional", i18nKey: "training.rollFocusPositional", emoji: "🎯" },
  { value: "hard",       i18nKey: "training.rollFocusHard",       emoji: "🔥" },
  { value: "survival",   i18nKey: "training.rollFocusSurvival",   emoji: "🛡️" },
] as const;

// ── Partner belt colors (visual circles) ─────────────────────────────────────
const PARTNER_BELT_OPTIONS = [
  { value: "white",  i18nKey: "training.partnerBeltWhite",  bg: "bg-zinc-100",       ring: "ring-zinc-400",   text: "text-zinc-900" },
  { value: "blue",   i18nKey: "training.partnerBeltBlue",   bg: "bg-blue-600",       ring: "ring-blue-400",   text: "text-white" },
  { value: "purple", i18nKey: "training.partnerBeltPurple", bg: "bg-purple-600",     ring: "ring-purple-400", text: "text-white" },
  { value: "brown",  i18nKey: "training.partnerBeltBrown",  bg: "bg-amber-800",      ring: "ring-amber-600",  text: "text-white" },
  { value: "black",  i18nKey: "training.partnerBeltBlack",  bg: "bg-zinc-950 border border-zinc-600", ring: "ring-zinc-500", text: "text-white" },
] as const;

// ── Size diff options ─────────────────────────────────────────────────────────
const SIZE_DIFF_OPTIONS = [
  { value: "heavier", i18nKey: "training.sizeDiffHeavier", icon: "↑" },
  { value: "similar", i18nKey: "training.sizeDiffSimilar", icon: "—" },
  { value: "lighter", i18nKey: "training.sizeDiffLighter", icon: "↓" },
] as const;

type FormState = {
  date: string;
  duration_min: number;
  type: string;
  notes: string;
  instructor_name: string;
  /** B-09: Sparring partner username (stored in training_logs.partner_username) */
  partner_username: string;
  /** Body Management: post-training weight in kg (stored in training_logs.weight) */
  weight: string;
  /** Roll details (encoded into notes on submit for gi/nogi sessions) */
  roll_focus: string;
  partner_belt: string;
  size_diff: string;
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
  // Show custom input if value doesn't match any preset, or user clicked Custom pill
  const isPreset = (DURATION_PRESETS as number[]).includes(value);
  const [showCustom, setShowCustom] = useState(!isPreset);

  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{t("training.duration")}</label>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {DURATION_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { onChange(p); setShowCustom(false); }}
            className={`px-2.5 py-2 min-h-[36px] rounded-lg text-xs font-medium border transition-colors ${
              value === p && !showCustom
                ? "bg-[#10B981] border-[#10B981] text-white"
                : "bg-zinc-800 border-white/10 text-gray-400 hover:border-white/20"
            }`}
          >
            {p >= 60 ? `${p / 60}h` : `${p}m`}
          </button>
        ))}
        {/* Custom pill — shows input when selected */}
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className={`px-2.5 py-2 min-h-[36px] rounded-lg text-xs font-medium border transition-colors ${
            showCustom || !isPreset
              ? "bg-[#10B981] border-[#10B981] text-white"
              : "bg-zinc-800 border-white/10 text-gray-400 hover:border-white/20"
          }`}
        >
          {!isPreset && !showCustom ? `${value}m` : t("training.durationCustom")}
        </button>
      </div>
      {/* Custom number input — only shown when Custom is active */}
      {(showCustom || !isPreset) && (
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={1}
          max={480}
          onChange={(e) => onChange(parseInt(e.target.value) || 60)}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30"
          placeholder={t("training.customMinutes")}
        />
      )}
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
// memo: prevents re-render when sibling state changes (e.g. filter/delete) in parent
const TrainingLogForm = memo(function TrainingLogForm({
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
  const isOnline = useOnlineStatus();
  const techniqueInputRef = useRef<HTMLInputElement>(null);
  const [showOptional, setShowOptional] = useState(false);

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

  return (
    <BottomSheet
      isOpen={showForm}
      onClose={onClose}
      title={t("training.title")}
    >
    <form
      onSubmit={onSubmit}
      className=""
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
          <div className="flex items-center gap-2">
            {form.date !== getYesterdayDateString() && (
              <button
                type="button"
                onClick={() => setForm({ ...form, date: getYesterdayDateString() })}
                className="text-xs text-gray-500 hover:text-white font-medium"
              >
                {t("training.yesterday")}
              </button>
            )}
            {form.date !== today && (
              <button
                type="button"
                onClick={() => setForm({ ...form, date: today })}
                className="text-xs text-emerald-500 hover:text-emerald-300 font-medium"
              >
                {t("training.backToToday")}
              </button>
            )}
          </div>
        </div>
        <input
          type="date"
          value={form.date}
          max={today}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30"
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

      {/* Type — Giant Gi/No-Gi toggle + sub-types */}
      <div className="mb-3">
        <label className="block text-gray-400 text-xs mb-2">{t("training.typeShort")}</label>
        {/* Primary: Gi / No-Gi — giant 2-tap selector */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          {[
            { value: "gi",   label: "Gi",    activeClass: "border-blue-500 bg-blue-500/25 text-blue-300 shadow-sm shadow-blue-500/20" },
            { value: "nogi", label: "No-Gi", activeClass: "border-orange-500 bg-orange-500/25 text-orange-300 shadow-sm shadow-orange-500/20" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm({ ...form, type: opt.value })}
              className={`py-3 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                form.type === opt.value
                  ? opt.activeClass
                  : "border-white/10 bg-zinc-800/60 text-gray-500 hover:border-white/20 hover:text-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* Secondary: Other types — compact sub-grid */}
        <div className="grid grid-cols-4 gap-1.5">
          {TRAINING_TYPES.filter((tt) => tt.value !== "gi" && tt.value !== "nogi").map((tt) => {
            const active = form.type === tt.value;
            return (
              <button
                key={tt.value}
                type="button"
                onClick={() => setForm({ ...form, type: tt.value })}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                  active
                    ? "bg-[#10B981]/25 border-[#10B981]/60 text-[#10B981] shadow-sm shadow-[#10B981]/20"
                    : "bg-zinc-800/60 border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="leading-none text-xs">{tt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Competition details */}
      {form.type === "competition" && (
        <div className="mb-3 bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-2">
          <p className="text-xs text-red-400 font-semibold mb-2">{t("competition.formHeader")}</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.result")}</label>
              <select
                value={compForm.result}
                onChange={(e) => setCompForm({ ...compForm, result: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-zinc-700 focus:outline-none focus:border-white/30"
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
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-500"
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
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.event")} (optional)</label>
              <input
                type="text"
                value={compForm.event}
                onChange={(e) => setCompForm({ ...compForm, event: e.target.value })}
                placeholder={t("competition.eventPlaceholder")}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-gray-400 text-xs mb-1">{t("competition.opponentBelt")} (optional)</label>
              <select
                value={compForm.opponent_rank}
                onChange={(e) => setCompForm({ ...compForm, opponent_rank: e.target.value })}
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-zinc-700 focus:outline-none focus:border-white/30"
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
                className="w-full bg-zinc-800 text-white rounded-lg px-2 py-1.5 text-sm border border-zinc-700 focus:outline-none focus:border-white/30"
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
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-500"
          />
          <datalist id="technique-autocomplete-list">
            {techniqueSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className="text-xs text-gray-500 mt-0.5">{t("competition.techAppendNote")}</p>
        </div>
      )}

      {/* ── Optional details toggle (Instructor, Partner, Weight) ─────────── */}
      <button
        type="button"
        onClick={() => setShowOptional((v) => !v)}
        className="flex items-center gap-1.5 w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1 mb-2 group"
      >
        <svg
          className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${showOptional ? "rotate-90" : ""}`}
          viewBox="0 0 24 24" fill="none"
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="group-hover:text-zinc-300">Optional details</span>
        <span className="text-zinc-500 ml-1 font-normal">(instructor · partner · weight)</span>
      </button>

      {showOptional && (
        <div className="mb-3 space-y-3">
          {/* Instructor (B-04: optional, for BJJ Wrapped year-end stats) */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">{t("training.instructor")}</label>
            <input
              type="text"
              value={form.instructor_name ?? ""}
              onChange={(e) => setForm({ ...form, instructor_name: e.target.value })}
              placeholder={t("training.instructorPlaceholder")}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-500"
            />
          </div>

          {/* Partner Tag (B-09: optional @username for sparring partner) */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">{t("training.partnerTag")}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">@</span>
              <input
                type="text"
                value={form.partner_username}
                onChange={(e) => setForm({ ...form, partner_username: e.target.value.replace(/^@/, "").replace(/\s/g, "") })}
                placeholder={t("training.partnerTagPlaceholder")}
                className="w-full bg-zinc-800 text-white rounded-lg pl-7 pr-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-500"
              />
            </div>
          </div>

          {/* Post-training weight */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">{t("training.weight")}</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="20"
                max="500"
                value={form.weight ?? ""}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                placeholder={t("training.weightPlaceholder")}
                className="w-full bg-zinc-800 text-white rounded-lg pr-14 px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 placeholder-gray-600"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none select-none">
                {t("body.weightUnit")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Roll Details: shown only for Gi / No-Gi sparring sessions ─────── */}
      {(form.type === "gi" || form.type === "nogi") && (
        <div className="mb-3 bg-zinc-800/40 border border-white/8 rounded-xl p-3 space-y-3">
          <p className="text-xs font-semibold text-zinc-400 tracking-wide">🤼 {t("training.rollDetailsTitle")} <span className="font-normal text-zinc-500">({t("training.rollDetailsOptional")})</span></p>

          {/* Focus theme */}
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">{t("training.rollFocusLabel")}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {ROLL_FOCUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, roll_focus: form.roll_focus === opt.value ? "" : opt.value })}
                  className={`flex flex-col items-center gap-0.5 min-h-[52px] rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                    form.roll_focus === opt.value
                      ? "bg-emerald-900/30 border-emerald-500/50 text-emerald-300"
                      : "bg-zinc-800/60 border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  <span className="text-lg leading-none mt-2">{opt.emoji}</span>
                  <span className="text-xs leading-tight">{t(opt.i18nKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Partner belt color */}
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">{t("training.partnerBeltLabel")}</p>
            <div className="flex gap-2">
              {PARTNER_BELT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, partner_belt: form.partner_belt === opt.value ? "" : opt.value })}
                  className={`relative flex-1 flex flex-col items-center gap-1 min-h-[52px] rounded-xl border transition-all active:scale-95 ${
                    form.partner_belt === opt.value
                      ? `border-white/40 ring-2 ${opt.ring} bg-zinc-800`
                      : "border-white/10 bg-zinc-800/60 hover:border-white/20"
                  }`}
                  title={t(opt.i18nKey)}
                >
                  <span className={`w-6 h-6 rounded-full ${opt.bg} inline-block mt-2.5`} />
                  <span className="text-xs text-zinc-500 leading-none mb-1">{t(opt.i18nKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Size diff */}
          <div>
            <p className="text-xs text-zinc-500 mb-1.5">{t("training.partnerSizeLabel")}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {SIZE_DIFF_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, size_diff: form.size_diff === opt.value ? "" : opt.value })}
                  className={`flex flex-col items-center gap-0.5 min-h-[48px] rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                    form.size_diff === opt.value
                      ? "bg-zinc-700/60 border-zinc-400/50 text-zinc-200"
                      : "bg-zinc-800/60 border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                  }`}
                >
                  <span className="text-lg leading-none mt-2 font-bold">{opt.icon}</span>
                  <span className="text-xs">{t(opt.i18nKey)}</span>
                </button>
              ))}
            </div>
          </div>
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
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-zinc-700 focus:outline-none focus:border-white/30 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || !isOnline}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 disabled:opacity-50 text-white font-semibold py-3 min-h-[44px] rounded-lg text-sm transition-all"
        >
          {loading ? t("training.saving") : t("training.save")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-3 min-h-[44px] text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-white/10 rounded-lg text-sm transition-colors"
        >
          {t("training.cancel")}
        </button>
      </div>
    </form>
    </BottomSheet>
  );
});

export default TrainingLogForm;

"use client";

import React from "react";
import { useLocale } from "@/lib/i18n";
import { useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { CATEGORY_VALUES, type TechniqueFormState } from "@/lib/techniqueLogTypes";
import BottomSheet from "@/components/ui/BottomSheet";
import { BJJ_TECHNIQUE_SUGGESTIONS } from "@/lib/bjjTechniques";

type Props = {
  showForm: boolean;
  bulkMode: boolean;
  form: TechniqueFormState;
  setForm: (f: TechniqueFormState) => void;
  bulkText: string;
  setBulkText: (v: string) => void;
  bulkCategory: string;
  setBulkCategory: (v: string) => void;
  bulkMastery: number;
  setBulkMastery: (v: number) => void;
  loading: boolean;
  formError: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onBulkSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  onCloseBulk: () => void;
  /** Existing user technique names for autocomplete de-duplication */
  existingNames?: string[];
};

export default function TechniqueLogForm({
  showForm,
  bulkMode,
  form,
  setForm,
  bulkText,
  setBulkText,
  bulkCategory,
  setBulkCategory,
  bulkMastery,
  setBulkMastery,
  loading,
  formError,
  onSubmit,
  onBulkSubmit,
  onClose,
  onCloseBulk,
  existingNames = [],
}: Props) {
  const { t } = useLocale();

  // Build deduplicated suggestions: existing user techniques first, then static list
  const existingSet = new Set(existingNames.map((n) => n.toLowerCase()));
  const nameSuggestions = [
    ...existingNames,
    ...BJJ_TECHNIQUE_SUGGESTIONS.filter((s) => !existingSet.has(s.toLowerCase())),
  ];

  // ── beforeunload: warn if unsaved form input ──────────────────────────────
  const hasInput = showForm && (form.name.trim() !== "" || form.notes.trim() !== "" || bulkText.trim() !== "");
  useUnsavedChanges(hasInput);

  // ── Single add form ────────────────────────────────────────────────────────
  if (!bulkMode) {
    return (
      <BottomSheet
        isOpen={showForm}
        onClose={onClose}
        title={t("techniques.title")}
      >
      <form
        onSubmit={onSubmit}
        noValidate
        className=""
      >
        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
            {formError}
          </div>
        )}
        <div className="mb-3">
          <label className="block text-zinc-400 text-xs mb-1">
            {t("techniques.name")}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("techniques.namePlaceholder")}
            list="technique-name-suggestions"
            autoComplete="off"
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
            required
          />
          <datalist id="technique-name-suggestions">
            {nameSuggestions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-zinc-400 text-xs mb-1">
              {t("techniques.category")}
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              aria-label={t("techniques.category")}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
            >
              {CATEGORY_VALUES.map((catVal) => (
                <option key={catVal} value={catVal}>
                  {t("techniques.categories." + catVal)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-zinc-400 text-xs mb-1">
              {t("techniques.mastery")}
            </label>
            <select
              value={form.mastery_level}
              onChange={(e) =>
                setForm({ ...form, mastery_level: Number(e.target.value) })
              }
              aria-label={t("techniques.mastery")}
              className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
            >
              {[1, 2, 3, 4, 5].map((level) => (
                <option key={level} value={level}>
                  {level} - {t("techniques.masteryLevels." + level)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-zinc-400 text-xs mb-1">
            {t("techniques.notes")}
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder={t("techniques.notesPlaceholder")}
            rows={2}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-all"
          >
            {loading ? t("techniques.saving") : t("techniques.save")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            {t("techniques.cancel")}
          </button>
        </div>
      </form>
      </BottomSheet>
    );
  }

  // ── Bulk add form ──────────────────────────────────────────────────────────
  return (
    <BottomSheet
      isOpen={showForm}
      onClose={onCloseBulk}
      title={t("techniques.bulkTitle")}
    >
    <form
      onSubmit={onBulkSubmit}
      className=""
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-violet-600">
          {t("techniques.bulkTitle")}
        </span>
        <span className="text-xs text-zinc-400">{t("techniques.bulkDesc")}</span>
      </div>
      {formError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
          {formError}
        </div>
      )}
      <div className="mb-3">
        <label className="block text-zinc-400 text-xs mb-1">
          {t("techniques.nameMultiple")}
        </label>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={t("techniques.nameMultiplePlaceholder")}
          rows={6}
          className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30 resize-none font-mono"
        />
        {bulkText && (
          <p className="text-xs text-zinc-400 mt-1">
            {t("techniques.bulkCount", {
              n: bulkText.split("\n").filter((n) => n.trim()).length,
            })}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            {t("techniques.categoryMultiple")}
          </label>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            aria-label={t("techniques.categoryMultiple")}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
          >
            {CATEGORY_VALUES.map((catVal) => (
              <option key={catVal} value={catVal}>
                {t("techniques.categories." + catVal)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-zinc-400 text-xs mb-1">
            {t("techniques.masteryMultiple")}
          </label>
          <select
            value={bulkMastery}
            onChange={(e) => setBulkMastery(Number(e.target.value))}
            aria-label={t("techniques.masteryMultiple")}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
          >
            {[1, 2, 3, 4, 5].map((level) => (
              <option key={level} value={level}>
                {level} - {t("techniques.masteryLevels." + level)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? t("techniques.saving") : t("techniques.bulkSave")}
        </button>
        <button
          type="button"
          onClick={onCloseBulk}
          className="px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          {t("techniques.cancel")}
        </button>
      </div>
    </form>
    </BottomSheet>
  );
}

"use client";

import React from "react";
import { useLocale } from "@/lib/i18n";
import { CATEGORY_VALUES, type TechniqueFormState } from "@/lib/techniqueLogTypes";

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
}: Props) {
  const { t } = useLocale();

  if (!showForm) return null;

  // ── Single add form ────────────────────────────────────────────────────────
  if (!bulkMode) {
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
        <div className="mb-3">
          <label className="block text-gray-400 text-xs mb-1">
            {t("techniques.name")}
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("techniques.namePlaceholder")}
            className="w-full bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm border border-white/10 focus:outline-none focus:border-white/30"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-gray-400 text-xs mb-1">
              {t("techniques.category")}
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
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
            <label className="block text-gray-400 text-xs mb-1">
              {t("techniques.mastery")}
            </label>
            <select
              value={form.mastery_level}
              onChange={(e) =>
                setForm({ ...form, mastery_level: Number(e.target.value) })
              }
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
          <label className="block text-gray-400 text-xs mb-1">
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
            className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? t("techniques.saving") : t("techniques.save")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
          >
            {t("techniques.cancel")}
          </button>
        </div>
      </form>
    );
  }

  // ── Bulk add form ──────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={onBulkSubmit}
      className="bg-zinc-900 rounded-xl p-4 border border-[#7c3aed]/40 mb-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-[#7c3aed]">
          {t("techniques.bulkTitle")}
        </span>
        <span className="text-xs text-gray-500">{t("techniques.bulkDesc")}</span>
      </div>
      {formError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 text-red-400 text-xs">
          {formError}
        </div>
      )}
      <div className="mb-3">
        <label className="block text-gray-400 text-xs mb-1">
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
          <p className="text-xs text-gray-500 mt-1">
            {t("techniques.bulkCount", {
              n: bulkText.split("\n").filter((n) => n.trim()).length,
            })}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-gray-400 text-xs mb-1">
            {t("techniques.categoryMultiple")}
          </label>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
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
          <label className="block text-gray-400 text-xs mb-1">
            {t("techniques.masteryMultiple")}
          </label>
          <select
            value={bulkMastery}
            onChange={(e) => setBulkMastery(Number(e.target.value))}
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
          className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? t("techniques.saving") : t("techniques.bulkSave")}
        </button>
        <button
          type="button"
          onClick={onCloseBulk}
          className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          {t("techniques.cancel")}
        </button>
      </div>
    </form>
  );
}

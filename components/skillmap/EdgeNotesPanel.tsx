"use client";

type Props = {
  edgeId: string;
  notes: string;
  onChange: (notes: string) => void;
  onSave: () => void;
  onClose: () => void;
  t: (k: string) => string;
};

export default function EdgeNotesPanel({ notes, onChange, onSave, onClose, t }: Props) {
  return (
    <div className="mt-2 bg-zinc-900 border border-indigo-500/30 rounded-xl p-3 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-white">📝 {t("skillmap.edgeNotesTitle")}</span>
        <button
          onClick={onClose}
          className="ml-auto text-zinc-500 hover:text-zinc-300 text-sm leading-none"
          aria-label={t("common.cancel")}
        >✕</button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("skillmap.edgeNotesPlaceholder")}
        className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 resize-none"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={onClose}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-2 rounded-lg transition-colors"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={onSave}
          className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}

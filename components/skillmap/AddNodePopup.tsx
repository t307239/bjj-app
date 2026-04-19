"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  screenX: number;
  screenY: number;
  onAdd: (name: string) => void;
  onCancel: () => void;
  t: (k: string) => string;
};

export default function AddNodePopup({ screenX, screenY, onAdd, onCancel, t }: Props) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { requestAnimationFrame(() => ref.current?.focus()); }, []);

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("skillmap.addTechnique")}
      style={{ position: "fixed", left: screenX, top: screenY, zIndex: 30 }}
      className="bg-zinc-800 border border-white/20 rounded-xl shadow-2xl p-3 w-48"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={ref}
        type="text"
        placeholder={t("skillmap.namePlaceholder")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onAdd(name.trim());
          if (e.key === "Escape") onCancel();
        }}
        className="w-full bg-zinc-700 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none mb-2"
        maxLength={80}
      />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 py-2 min-h-[44px] rounded-lg transition-colors">
          {t("common.cancel")}
        </button>
        <button
          onClick={() => { if (name.trim()) onAdd(name.trim()); }}
          disabled={!name.trim()}
          className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-xs text-white py-2 min-h-[44px] rounded-lg transition-colors"
        >
          {t("skillmap.addBtn")}
        </button>
      </div>
    </div>
  );
}

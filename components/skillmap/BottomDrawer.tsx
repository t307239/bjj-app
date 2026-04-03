"use client";

import { useState, useRef, useLayoutEffect } from "react";
import { type Node } from "@xyflow/react";

type Props = {
  node: Node;
  isPro: boolean;
  onAddChild: (name: string) => void;
  onConnectTo: () => void;
  onRemove: () => void;
  onClose: () => void;
  t: (k: string) => string;
};

export default function BottomDrawer({
  node,
  isPro,
  onAddChild,
  onConnectTo,
  onRemove,
  onClose,
  t,
}: Props) {
  const [mode, setMode] = useState<"menu" | "addChild" | "confirmDelete">("menu");
  const [childName, setChildName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => { if (mode === "addChild") inputRef.current?.focus(); }, [mode]);

  return (
    <div className="fixed inset-0 z-50" onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-white/10 rounded-t-2xl p-5 pb-8"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
        <p className="text-xs text-gray-400 text-center mb-4 font-semibold truncate px-6">
          {String(node.data.label)}
        </p>

        {mode === "menu" && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setMode("addChild")}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">➕</span>
              {t("skillmap.drawerAddChild")}
            </button>
            <button
              onClick={() => { onClose(); onConnectTo(); }}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">🔗</span>
              {t("skillmap.drawerConnect")}
            </button>
            {isPro ? (
              <button
                onClick={() => setMode("confirmDelete")}
                className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-red-400 text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
              >
                <span className="text-lg w-7 text-center">🗑️</span>
                {t("skillmap.drawerRemove")}
              </button>
            ) : (
              <div className="w-full flex items-center gap-3 bg-zinc-800/50 text-zinc-500 text-sm px-4 py-3.5 rounded-xl cursor-not-allowed">
                <span className="text-lg w-7 text-center">🔒</span>
                {t("skillmap.drawerRemove")} (Pro)
              </div>
            )}
            <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-300 py-2.5 mt-1 transition-colors">
              {t("common.cancel")}
            </button>
          </div>
        )}

        {mode === "addChild" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-gray-400 text-center">{t("skillmap.drawerAddChildHint")}</p>
            <input
              ref={inputRef}
              type="text"
              placeholder={t("skillmap.namePlaceholder")}
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && childName.trim()) { onAddChild(childName.trim()); onClose(); }
                if (e.key === "Escape") setMode("menu");
              }}
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              maxLength={80}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMode("menu")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-3 rounded-xl transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => { if (childName.trim()) { onAddChild(childName.trim()); onClose(); } }}
                disabled={!childName.trim()}
                className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                {t("skillmap.addBtn")}
              </button>
            </div>
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-300 text-center px-4">{t("skillmap.deleteConfirmMsg")}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("menu")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 text-sm py-3 rounded-xl transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => { onRemove(); onClose(); }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { type Node } from "@xyflow/react";
import { PRESET_POSITIONS } from "./constants";

/**
 * iOS Safari virtual keyboard pushes `position:fixed` elements off-screen.
 * We listen to the VisualViewport resize event and adjust the drawer's
 * bottom offset so it stays visible above the keyboard.
 */
function useIOSKeyboardOffset() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const handler = () => {
      // When the virtual keyboard opens, visualViewport.height shrinks.
      // The difference between window.innerHeight and visualViewport.height
      // is the keyboard height.
      const keyboardHeight = window.innerHeight - vv.height;
      setOffset(Math.max(0, keyboardHeight));
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);
  return offset;
}

type Props = {
  node: Node;
  isPro: boolean;
  onAddChild: (name: string) => void;
  onConnectTo: () => void;
  onRemove: () => void;
  onEditTags: (tags: string[]) => void;
  onClose: () => void;
  t: (k: string) => string;
};

export default function BottomDrawer({
  node,
  isPro,
  onAddChild,
  onConnectTo,
  onRemove,
  onEditTags,
  onClose,
  t,
}: Props) {
  const [mode, setMode] = useState<"menu" | "addChild" | "confirmDelete" | "editTags">("menu");
  const [childName, setChildName] = useState("");
  const [customTagInput, setCustomTagInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (mode === "addChild") requestAnimationFrame(() => inputRef.current?.focus()); }, [mode]);
  useEffect(() => { if (mode === "editTags") requestAnimationFrame(() => tagInputRef.current?.focus()); }, [mode]);

  // Focus trap + ESC to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key !== "Tab" || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Auto-focus drawer on mount
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const keyboardOffset = useIOSKeyboardOffset();

  const currentTags: string[] = ((node.data as { tags?: string[] }).tags ?? []);

  const toggleTag = (tag: string) => {
    const next = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    onEditTags(next);
  };

  const addCustomTag = () => {
    const tag = customTagInput.trim();
    if (!tag || currentTags.includes(tag)) { setCustomTagInput(""); return; }
    onEditTags([...currentTags, tag]);
    setCustomTagInput("");
  };

  return (
    <div className="fixed inset-0 z-50" style={{ touchAction: "auto" }} onPointerDown={onClose}>
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={String(node.data.label)}
        tabIndex={-1}
        className="absolute left-0 right-0 bg-zinc-900 border-t border-white/10 rounded-t-2xl p-5 pb-8 outline-none"
        style={{
          bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 0,
          zIndex: 51,
          touchAction: "auto",
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-zinc-600 rounded-full mx-auto mb-4" />
        <p className="text-xs text-zinc-400 text-center mb-4 font-semibold truncate px-6">
          {String(node.data.label)}
        </p>

        {mode === "menu" && (
          <div className="flex flex-col gap-2">
            <button type="button"
              onClick={() => {
                setMode("addChild");
                // iOS Safari: rAF keeps us within the user-gesture activation window
                requestAnimationFrame(() => inputRef.current?.focus());
              }}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">➕</span>
              {t("skillmap.drawerAddChild")}
            </button>
            <button type="button"
              onClick={() => { onClose(); onConnectTo(); }}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">🔗</span>
              {t("skillmap.drawerConnect")}
            </button>
            <button type="button"
              onClick={() => {
                setMode("editTags");
                requestAnimationFrame(() => tagInputRef.current?.focus());
              }}
              className="w-full flex items-center gap-3 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-sm font-medium px-4 py-3.5 rounded-xl transition-all"
            >
              <span className="text-lg w-7 text-center">🏷️</span>
              {t("skillmap.drawerEditTags")}
              {currentTags.length > 0 && (
                <span className="ml-auto text-xs text-emerald-400 font-semibold">{currentTags.length}</span>
              )}
            </button>
            {isPro ? (
              <button type="button"
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
            <button type="button" onClick={onClose} className="w-full text-sm text-zinc-400 hover:text-zinc-300 py-2.5 mt-1 transition-colors">
              {t("common.cancel")}
            </button>
          </div>
        )}

        {mode === "addChild" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400 text-center">{t("skillmap.drawerAddChildHint")}</p>
            <input
              ref={inputRef}
              type="text"
              autoFocus
              inputMode="text"
              enterKeyHint="done"
              placeholder={t("skillmap.namePlaceholder")}
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && childName.trim()) { onAddChild(childName.trim()); onClose(); }
                if (e.key === "Escape") setMode("menu");
              }}
              onTouchStart={(e) => e.stopPropagation()}
              className="w-full bg-zinc-800 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
              style={{ touchAction: "auto" }}
              maxLength={80}
            />
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setMode("menu")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm py-3 rounded-xl transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button type="button"
                onClick={() => { if (childName.trim()) { onAddChild(childName.trim()); onClose(); } }}
                disabled={!childName.trim()}
                className="flex-1 bg-[#10B981] hover:bg-[#0d9668] disabled:opacity-40 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
              >
                {t("skillmap.addBtn")}
              </button>
            </div>
          </div>
        )}

        {mode === "editTags" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-zinc-400 text-center">{t("skillmap.drawerEditTagsHint")}</p>
            {/* Preset + custom tags as toggle chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_POSITIONS.map((tag) => (
                <button type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all active:scale-95 ${
                    currentTags.includes(tag)
                      ? "bg-indigo-600 border-indigo-500 text-white font-semibold"
                      : "bg-zinc-800 border-white/10 text-zinc-400 hover:border-white/30"
                  }`}
                >
                  {currentTags.includes(tag) ? "✓ " : ""}{tag}
                </button>
              ))}
              {/* Non-preset custom tags */}
              {currentTags.filter((t) => !PRESET_POSITIONS.includes(t)).map((tag) => (
                <button type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="text-xs px-2.5 py-1 rounded-full border bg-indigo-600 border-indigo-500 text-white font-semibold transition-all active:scale-95"
                >
                  ✓ {tag}
                </button>
              ))}
            </div>
            {/* Custom tag input */}
            <div className="flex gap-2">
              <input
                ref={tagInputRef}
                type="text"
                autoFocus
                inputMode="text"
                enterKeyHint="done"
                placeholder={t("skillmap.tagCustomPlaceholder")}
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustomTag();
                  if (e.key === "Escape") setMode("menu");
                }}
                onTouchStart={(e) => e.stopPropagation()}
                className="flex-1 bg-zinc-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/30"
                style={{ touchAction: "auto" }}
                maxLength={40}
              />
              <button type="button"
                onClick={addCustomTag}
                disabled={!customTagInput.trim()}
                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-xl transition-colors"
              >
                +
              </button>
            </div>
            <button type="button"
              onClick={() => setMode("menu")}
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
            >
              {t("common.save")}
            </button>
          </div>
        )}

        {mode === "confirmDelete" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-300 text-center px-4">{t("skillmap.deleteConfirmMsg")}</p>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setMode("menu")}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm py-3 rounded-xl transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button type="button"
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

"use client";

import { useState, useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";

const LS_PREFIX = "bjj_tech_video_";

function getStoredUrl(id: string): string {
  try {
    return localStorage.getItem(`${LS_PREFIX}${id}`) ?? "";
  } catch {
    return "";
  }
}

function setStoredUrl(id: string, url: string): void {
  try {
    if (url.trim()) {
      localStorage.setItem(`${LS_PREFIX}${id}`, url.trim());
    } else {
      localStorage.removeItem(`${LS_PREFIX}${id}`);
    }
  } catch { /* ignore */ }
}

/** Converts various YouTube URL formats to a clean watch URL */
function normalizeYouTubeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // Already short / standard — return as-is if looks like a URL
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    // youtu.be short links
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1);
      return id ? `https://www.youtube.com/watch?v=${id}` : s;
    }
    // youtube.com/watch, /shorts, /embed
    if (url.hostname.includes("youtube.com")) return s;
    // Non-YouTube URL — pass through
    return s;
  } catch {
    return s;
  }
}

interface Props {
  techniqueId: string;
}

export default function TechniqueVideoButton({ techniqueId }: Props) {
  const { t } = useLocale();
  const [url, setUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage after mount (SSR-safe)
  useEffect(() => {
    setUrl(getStoredUrl(techniqueId));
  }, [techniqueId]);

  // Focus input when editing opens
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const normalized = normalizeYouTubeUrl(draft);
    setUrl(normalized);
    setStoredUrl(techniqueId, normalized);
    setEditing(false);
  };

  const handleRemove = () => {
    setUrl("");
    setStoredUrl(techniqueId, "");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setEditing(false); setDraft(""); }
  };

  // ── Editing mode ──────────────────────────────────────────────────────────────
  if (editing) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <input
          ref={inputRef}
          type="url"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://youtu.be/..."
          className="flex-1 bg-zinc-800 border border-white/15 text-xs text-zinc-200 rounded-lg px-2.5 py-1.5 min-h-[36px] focus:outline-none focus:border-emerald-500 placeholder-zinc-600"
        />
        <button
          onClick={handleSave}
          className="text-xs font-semibold text-black bg-emerald-500 hover:bg-emerald-400 rounded-lg px-2.5 py-1.5 min-h-[36px] transition-colors flex-shrink-0"
        >
          {t("common.save")}
        </button>
        <button
          onClick={() => { setEditing(false); setDraft(""); }}
          className="text-xs text-zinc-500 hover:text-zinc-300 rounded-lg px-2 py-1.5 min-h-[36px] transition-colors flex-shrink-0"
        >
          {t("training.cancel")}
        </button>
      </div>
    );
  }

  // ── URL set — show link + remove ──────────────────────────────────────────────
  if (url) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors min-h-[32px] px-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:border-red-400/30"
        >
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          {t("techniques.watchVideo")}
        </a>
        <button
          onClick={() => { setDraft(url); setEditing(true); }}
          className="text-zinc-600 hover:text-zinc-400 p-1.5 min-h-[32px] min-w-[32px] transition-colors rounded-lg flex items-center justify-center"
          title={t("techniques.editVideo")}
          aria-label={t("techniques.editVideo")}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={handleRemove}
          className="text-zinc-600 hover:text-red-400 p-1.5 min-h-[32px] min-w-[32px] transition-colors rounded-lg flex items-center justify-center"
          title={t("techniques.removeVideo")}
          aria-label={t("techniques.removeVideo")}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // ── No URL — show add button ──────────────────────────────────────────────────
  return (
    <button
      onClick={() => { setDraft(""); setEditing(true); }}
      className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 mt-1.5 transition-colors min-h-[28px] group"
      title={t("techniques.addVideo")}
    >
      <svg className="w-3 h-3 group-hover:text-red-400 transition-colors" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
      <span>{t("techniques.addVideo")}</span>
    </button>
  );
}

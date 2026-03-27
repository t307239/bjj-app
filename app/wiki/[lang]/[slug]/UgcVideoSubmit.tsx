"use client";

/**
 * UgcVideoSubmit.tsx
 *
 * UGCビデオ投稿フォーム。
 * - YouTube URLを入力 → POST /api/wiki/submit-video
 * - 送信データは ugc_video_submissions (status: pending) に入り即時反映しない
 * - LLMトリアージ後に承認されたURLのみ wiki_pages.video_url に反映される
 */

import { useState } from "react";

interface Props {
  slug: string;
  lang: string;
  ugcLabel: string;
  ugcCta: string;
}

type Status = "idle" | "submitting" | "success" | "error";

/** YouTube URL から video ID を抽出 */
function extractVideoId(url: string): string | null {
  // youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pat of patterns) {
    const m = url.match(pat);
    if (m) return m[1];
  }
  return null;
}

export default function UgcVideoSubmit({ slug, lang, ugcLabel, ugcCta }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const successMsg =
    lang === "ja"
      ? "ありがとうございます！審査後に掲載されます 🎬"
      : lang === "pt"
      ? "Obrigado! O vídeo será revisado em breve 🎬"
      : "Thanks! Your video will be reviewed and added soon 🎬";

  const placeholder =
    lang === "ja"
      ? "https://www.youtube.com/watch?v=..."
      : "https://www.youtube.com/watch?v=...";

  const invalidMsg =
    lang === "ja"
      ? "YouTube の URL を入力してください"
      : lang === "pt"
      ? "Por favor, insira um URL válido do YouTube"
      : "Please enter a valid YouTube URL";

  const submitLabel =
    lang === "ja" ? "送信" : lang === "pt" ? "Enviar" : "Submit";
  const cancelLabel =
    lang === "ja" ? "キャンセル" : lang === "pt" ? "Cancelar" : "Cancel";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const videoId = extractVideoId(url.trim());
    if (!videoId) {
      setErrorMsg(invalidMsg);
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/wiki/submit-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, lang, youtube_url: url.trim(), video_id: videoId }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMsg(
        lang === "ja"
          ? "送信に失敗しました。もう一度お試しください。"
          : lang === "pt"
          ? "Falha ao enviar. Tente novamente."
          : "Submission failed. Please try again."
      );
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
        <span className="text-xl">✅</span>
        <p className="text-sm text-emerald-400">{successMsg}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <span className="text-2xl shrink-0 mt-0.5">🎬</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-300 mb-3">{ugcLabel}</p>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 px-4 py-2 text-sm font-medium text-pink-400 hover:text-pink-300 transition-colors"
            >
              {ugcCta}
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setErrorMsg("");
                }}
                placeholder={placeholder}
                required
                className="w-full rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
              />
              {errorMsg && (
                <p className="text-xs text-red-400">{errorMsg}</p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={status === "submitting" || !url.trim()}
                  className="rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-semibold text-white transition-colors"
                >
                  {status === "submitting" ? "..." : submitLabel}
                </button>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setUrl(""); setErrorMsg(""); setStatus("idle"); }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {cancelLabel}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {lang === "ja"
                  ? "※ 送信されたURLは審査後に掲載されます"
                  : lang === "pt"
                  ? "* URLs enviadas serão revisadas antes de serem publicadas"
                  : "* Submitted URLs are reviewed before being published"}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

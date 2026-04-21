"use client";

/**
 * B-06: Instagram Story / SNS シェアボタン
 * html2canvas の代わりに Canvas API でシェア画像を生成。
 * Web Share API 対応デバイスは直接シェア、非対応は PNG ダウンロード。
 */
import { useState, useCallback } from "react";
import { TRAINING_TYPES } from "@/lib/trainingTypes";
import { type TrainingEntry } from "@/lib/trainingLogHelpers";
import { clientLogger } from "@/lib/clientLogger";

type Props = {
  entry: TrainingEntry;
};

const BELT_COLORS: Record<string, string> = {
  white: "#f5f5f4", blue: "#3b82f6", purple: "#a855f7",
  brown: "#92400e", black: "#27272a",
};

function drawShareCard(entry: TrainingEntry): HTMLCanvasElement {
  // 9:16 story aspect ratio (1080×1920 scaled to 540×960)
  const W = 540;
  const H = 960;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#09090b");   // zinc-950
  bg.addColorStop(1, "#0d1a13");   // subtle emerald tint
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  ctx.fillStyle = "#10B981";
  ctx.fillRect(0, 0, W, 4);

  // Training type color
  const typeInfo = TRAINING_TYPES.find((t) => t.value === entry.type);
  const typeAccent =
    entry.type === "gi" ? "#3b82f6" :
    entry.type === "nogi" ? "#f97316" :
    entry.type === "competition" ? "#ef4444" :
    "#10B981";

  // Center content area starts at ~240px from top
  const centerY = 240;

  // Big type badge pill
  const badgeW = 200;
  const badgeH = 44;
  const badgeX = (W - badgeW) / 2;
  const badgeY = centerY - 30;
  ctx.fillStyle = `${typeAccent}22`;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 22);
  ctx.fillStyle = typeAccent;
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const typeIcon = typeInfo?.icon ?? "🥋";
  const typeLabel = typeInfo?.label ?? entry.type;
  ctx.fillText(`${typeIcon}  ${typeLabel.toUpperCase()}`, W / 2, badgeY + badgeH / 2);

  // Duration — giant number
  const durH = entry.duration_min >= 60
    ? `${Math.floor(entry.duration_min / 60)}h${entry.duration_min % 60 > 0 ? `${entry.duration_min % 60}m` : ""}`
    : `${entry.duration_min}m`;

  ctx.font = "black 120px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Emerald gradient text simulation (fill solid then overlay)
  ctx.fillStyle = "#10B981";
  ctx.fillText(durH, W / 2, centerY + 140);

  // "of training" subtitle
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#71717a";
  ctx.fillText("of training", W / 2, centerY + 175);

  // Date
  const dateStr = new Date(entry.date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  ctx.font = "500 18px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#a1a1aa";
  ctx.fillText(dateStr, W / 2, centerY + 225);

  // Divider
  ctx.fillStyle = "#27272a";
  ctx.fillRect(W / 2 - 40, centerY + 248, 80, 1);

  // Notes (truncated, optional)
  if (entry.notes && !entry.notes.startsWith("__COMP__")) {
    const maxChars = 80;
    const noteText = entry.notes.length > maxChars
      ? entry.notes.slice(0, maxChars) + "…"
      : entry.notes;
    ctx.font = "italic 17px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#71717a";
    wrapText(ctx, `"${noteText}"`, W / 2, centerY + 285, W - 80, 26);
  }

  // Bottom brand block
  ctx.fillStyle = "#27272a";
  roundRect(ctx, W / 2 - 90, H - 110, 180, 54, 27);
  ctx.fillStyle = "#10B981";
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("BJJ App", W / 2 - 12, H - 84);

  // Kanji icon
  ctx.fillStyle = "#f4f4f5";
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  ctx.fillText("柔", W / 2 - 52, H - 84);

  // URL
  ctx.font = "400 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#52525b";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("bjj-app.net", W / 2, H - 38);

  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const testLine = line + word + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== "") {
      ctx.fillText(line.trim(), x, currentY);
      line = word + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, currentY);
}

export default function ShareButton({ entry }: Props) {
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const canvas = drawShareCard(entry);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas failed"))), "image/png")
      );
      const file = new File([blob], "bjj-training.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "BJJ Training Log",
          text: "Logged a training session on BJJ App 🥋 #BJJ #JiuJitsu #Training",
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bjj-training-${entry.date}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // User cancelled share — not an error
      if ((err as Error).name !== "AbortError") {
        clientLogger.error("share_button.share_error", {}, err);
      }
    } finally {
      setSharing(false);
    }
  }, [entry]);

  return (
    <button type="button"
      onClick={handleShare}
      disabled={sharing}
      className="text-zinc-400 hover:text-zinc-200 transition-colors p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center disabled:opacity-40"
      title="Share training"
      aria-label="Share training"
    >
      {sharing ? (
        <span className="inline-block w-4 h-4 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      )}
    </button>
  );
}

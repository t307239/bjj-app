"use client";

import { useState, useCallback } from "react";
import { useLocale } from "@/lib/i18n";
import { clientLogger } from "@/lib/clientLogger";

interface Props {
  type: "belt_promotion" | "streak" | "sessions";
  value: string;
  label: string;
}

const TYPE_ICONS: Record<Props["type"], string> = {
  belt_promotion: "🥋",
  streak: "🔥",
  sessions: "🏆",
};

const TYPE_COLORS: Record<Props["type"], { from: string; to: string; accent: string }> = {
  belt_promotion: { from: "#1e1b4b", to: "#312e81", accent: "#a78bfa" },
  streak: { from: "#1c1917", to: "#431407", accent: "#f97316" },
  sessions: { from: "#042f2e", to: "#064e3b", accent: "#10B981" },
};

function drawMilestoneCard(type: Props["type"], value: string, label: string): HTMLCanvasElement {
  const W = 540;
  const H = 960;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const colors = TYPE_COLORS[type];
  const icon = TYPE_ICONS[type];

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, colors.from);
  bg.addColorStop(1, colors.to);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  ctx.fillStyle = colors.accent;
  ctx.fillRect(0, 0, W, 4);

  // Decorative circles (subtle)
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.2, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.2, H * 0.7, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Center content
  const centerY = H / 2 - 60;

  // Icon
  ctx.font = "100px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, W / 2, centerY - 80);

  // Value (big number or text)
  ctx.font = "black 80px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(value, W / 2, centerY + 40);

  // Label
  ctx.font = "600 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = colors.accent;
  ctx.fillText(label.toUpperCase(), W / 2, centerY + 100);

  // Divider
  ctx.fillStyle = `${colors.accent}44`;
  ctx.fillRect(W / 2 - 40, centerY + 130, 80, 2);

  // "MILESTONE ACHIEVED" text
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#a1a1aa";
  ctx.letterSpacing = "4px";
  ctx.fillText("MILESTONE ACHIEVED", W / 2, centerY + 170);

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

export default function MilestoneShareCard({ type, value, label }: Props) {
  const { t } = useLocale();
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const canvas = drawMilestoneCard(type, value, label);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas failed"))), "image/png")
      );
      const file = new File([blob], "bjj-milestone.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: t("milestoneShare.shareTitle"),
          text: t("milestoneShare.shareText", { value, label }),
        });
      } else {
        // Fallback: download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bjj-milestone-${type}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        clientLogger.error("milestone_share.share_error", {}, err);
      }
    } finally {
      setSharing(false);
    }
  }, [type, value, label, t]);

  return (
    <button type="button"
      onClick={handleShare}
      disabled={sharing}
      className="text-zinc-400 hover:text-zinc-200 transition-colors p-2 rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center disabled:opacity-40"
      title={t("milestoneShare.buttonTitle")}
      aria-label={t("milestoneShare.buttonTitle")}
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

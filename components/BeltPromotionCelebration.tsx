"use client";

import { useEffect, useRef } from "react";

const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];
const BELT_COLORS: Record<string, { bg: string; text: string; label: string; emoji: string }> = {
  white:  { bg: "#f9fafb", text: "#111827", label: "White Belt",  emoji: "🤍" },
  blue:   { bg: "#3b82f6", text: "#ffffff", label: "Blue Belt",   emoji: "💙" },
  purple: { bg: "#9333ea", text: "#ffffff", label: "Purple Belt", emoji: "💜" },
  brown:  { bg: "#92400e", text: "#ffffff", label: "Brown Belt",  emoji: "🤎" },
  black:  { bg: "#18181b", text: "#ffffff", label: "Black Belt",  emoji: "🖤" },
};

/** Returns true if belt moved up in rank */
export function isBeltPromotion(from: string, to: string): boolean {
  return BELT_ORDER.indexOf(to) > BELT_ORDER.indexOf(from);
}

// ─── Confetti (pure Canvas, no npm) ────────────────────────────────────────────
function useConfetti(canvasRef: React.RefObject<HTMLCanvasElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#f97316", "#3b82f6", "#9333ea", "#f59e0b", "#10b981", "#fff"];
    type Particle = { x: number; y: number; vx: number; vy: number; color: string; w: number; h: number; angle: number; spin: number };
    const particles: Particle[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.4 - canvas.height * 0.2,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 3 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 10 + 6,
      h: Math.random() * 6 + 4,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.2,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07; // gravity
        p.angle += p.spin;
        if (p.y < canvas.height + 20) {
          alive++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, 1 - p.y / canvas.height);
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive > 0) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active, canvasRef]);
}

// ─── Main component ─────────────────────────────────────────────────────────────
interface Props {
  fromBelt: string;
  toBelt: string;
  onClose: () => void;
}

export default function BeltPromotionCelebration({ fromBelt, toBelt, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useConfetti(canvasRef, true);

  const info = BELT_COLORS[toBelt] ?? BELT_COLORS.white;
  const fromInfo = BELT_COLORS[fromBelt] ?? BELT_COLORS.white;

  const shareText = encodeURIComponent(
    `🥋 I just got promoted from ${fromInfo.label} to ${info.label} in BJJ! ${info.emoji}\nTracking my journey on BJJ App: https://bjj-app.net`
  );
  const shareUrl = `https://x.com/intent/tweet?text=${shareText}`;

  // Auto-close after 8s
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label="Belt promotion celebration"
    >
      {/* Canvas confetti layer (non-interactive) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className="relative z-10 bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-xs w-full mx-4 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Belt badge */}
        <div
          className="inline-flex items-center gap-2 px-6 py-2 rounded-full font-bold text-lg mb-4"
          style={{ background: info.bg, color: info.text }}
        >
          {info.emoji} {info.label}
        </div>

        <h2 className="text-2xl font-extrabold text-white mb-2">
          Congratulations! 🎉
        </h2>
        <p className="text-gray-400 text-sm mb-6">
          You advanced from <span className="font-semibold text-white">{fromInfo.label}</span>{" "}
          to <span className="font-bold" style={{ color: toBelt === "white" ? "#e5e7eb" : info.bg }}>{info.label}</span>.
          Keep rolling!
        </p>

        {/* Share button */}
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl mb-3 transition-colors text-sm"
          aria-label="Share belt promotion on X (Twitter)"
        >
          <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          Share on X
        </a>

        <button
          onClick={onClose}
          className="w-full text-gray-500 hover:text-gray-300 text-sm py-2 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

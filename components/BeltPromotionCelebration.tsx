"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n";

const BELT_ORDER = ["white", "blue", "purple", "brown", "black"];
const BELT_COLORS: Record<string, { bg: string; text: string; emoji: string; glow: string }> = {
  white:  { bg: "#f9fafb", text: "#111827", emoji: "🤍", glow: "rgba(249,250,251,0.4)" },
  blue:   { bg: "#3b82f6", text: "#ffffff", emoji: "💙", glow: "rgba(59,130,246,0.5)"  },
  purple: { bg: "#9333ea", text: "#ffffff", emoji: "💜", glow: "rgba(147,51,234,0.5)"  },
  brown:  { bg: "#92400e", text: "#ffffff", emoji: "🤎", glow: "rgba(146,64,14,0.5)"   },
  black:  { bg: "#18181b", text: "#ffffff", emoji: "🖤", glow: "rgba(24,24,27,0.6)"    },
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

    const COLORS = [
      "#f97316", "#3b82f6", "#9333ea", "#f59e0b",
      "#10b981", "#ffffff", "#ec4899", "#facc15",
      "#38bdf8", "#a78bfa",
    ];
    type Particle = {
      x: number; y: number; vx: number; vy: number;
      color: string; w: number; h: number; angle: number; spin: number;
      opacity: number;
    };

    // Launch 3 waves of confetti
    const makeParticles = (count: number): Particle[] =>
      Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.3 - canvas.height * 0.15,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 4 + 1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        w: Math.random() * 12 + 6,
        h: Math.random() * 7 + 4,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.25,
        opacity: 1,
      }));

    let particles = makeParticles(280);

    // Second burst after 600ms
    const t1 = setTimeout(() => { particles = [...particles, ...makeParticles(180)]; }, 600);
    // Third burst after 1200ms
    const t2 = setTimeout(() => { particles = [...particles, ...makeParticles(120)]; }, 1200);

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity
        p.angle += p.spin;
        p.vx *= 0.99; // air drag
        if (p.y < canvas.height + 30) {
          alive++;
          const fade = Math.max(0, 1 - p.y / (canvas.height * 1.1));
          ctx.save();
          ctx.globalAlpha = fade * p.opacity;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.angle);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive > 0) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, canvasRef]);
}

// ─── Pulse animation for belt badge ─────────────────────────────────────────────
function usePulse(): boolean {
  const [pulsed, setPulsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPulsed(true), 50);
    return () => clearTimeout(t);
  }, []);
  return pulsed;
}

// ─── Main component ─────────────────────────────────────────────────────────────
interface Props {
  fromBelt: string;
  toBelt: string;
  onClose: () => void;
}

export default function BeltPromotionCelebration({ fromBelt, toBelt, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useLocale();
  const pulsed = usePulse();
  useConfetti(canvasRef, true);

  const info = BELT_COLORS[toBelt] ?? BELT_COLORS.white;
  const fromInfo = BELT_COLORS[fromBelt] ?? BELT_COLORS.white;

  const BELT_LABELS: Record<string, string> = {
    white:  t("dashboard.beltWhite"),
    blue:   t("dashboard.beltBlue"),
    purple: t("dashboard.beltPurple"),
    brown:  t("dashboard.beltBrown"),
    black:  t("dashboard.beltBlack"),
  };
  const toLabel   = BELT_LABELS[toBelt]   ?? toBelt;
  const fromLabel = BELT_LABELS[fromBelt] ?? fromBelt;

  const shareText = encodeURIComponent(
    `🥋 I just got promoted from ${fromLabel} to ${toLabel} in BJJ! ${info.emoji}\nTracking my journey on BJJ App: https://bjj-app.net`
  );
  const shareUrl = `https://x.com/intent/tweet?text=${shareText}`;

  // NO auto-close — user must click "OSS 🥋" to dismiss

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-label={t("beltPromo.ariaDialog")}
      // Intentionally no onClick on backdrop — prevent accidental dismissal
    >
      {/* Canvas confetti layer (non-interactive) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        className="relative z-10 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: "linear-gradient(160deg, #18181b 0%, #09090b 100%)",
          border: `1px solid ${info.glow}`,
          boxShadow: `0 0 40px ${info.glow}, 0 25px 60px rgba(0,0,0,0.8)`,
        }}
      >
        {/* Stars decoration */}
        <div className="text-2xl mb-2 tracking-widest select-none" aria-hidden="true">
          ✨ 🥋 ✨
        </div>

        {/* Belt transition display */}
        <div className="flex items-center justify-center gap-3 mb-5">
          {/* From belt chip */}
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold opacity-60"
            style={{ background: fromInfo.bg, color: fromInfo.text }}
          >
            {fromInfo.emoji} {fromLabel}
          </span>

          {/* Arrow */}
          <span className="text-white/50 text-xl select-none" aria-hidden="true">→</span>

          {/* To belt chip — prominent with glow + pulse */}
          <span
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full font-bold text-base transition-transform duration-500"
            style={{
              background: info.bg,
              color: info.text,
              boxShadow: `0 0 20px ${info.glow}`,
              transform: pulsed ? "scale(1.08)" : "scale(0.85)",
            }}
          >
            {info.emoji} {toLabel}
          </span>
        </div>

        {/* Headline */}
        <h2
          className="text-3xl font-extrabold text-white mb-2 leading-tight"
          style={{ textShadow: `0 0 20px ${info.glow}` }}
        >
          {t("beltPromo.congrats")}
        </h2>
        <p className="text-gray-400 text-sm mb-2">
          {t("beltPromo.advanced", { from: fromLabel, to: toLabel })}
        </p>
        <p className="text-gray-500 text-xs mb-7 italic">
          {t("beltPromo.keepRolling")}
        </p>

        {/* Share button */}
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-3 rounded-xl mb-3 transition-colors text-sm border border-white/10"
          aria-label={t("beltPromo.ariaShareX")}
        >
          <svg className="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          {t("beltPromo.shareOnX")}
        </a>

        {/* Primary OSS button — required to dismiss */}
        <button
          onClick={onClose}
          className="w-full font-bold py-3.5 rounded-xl text-base transition-all duration-200 hover:scale-[1.02] active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${info.bg}, ${info.glow.replace("0.5)", "0.8)").replace("0.4)", "0.7)")})`,
            color: info.text,
            boxShadow: `0 4px 20px ${info.glow}`,
          }}
        >
          {t("beltPromo.oss")}
        </button>

        {/* Hint that modal won't close on its own */}
        <p className="text-gray-600 text-xs mt-3 select-none">
          {t("beltPromo.screenshotHint")}
        </p>
      </div>
    </div>
  );
}

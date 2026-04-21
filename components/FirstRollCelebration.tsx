"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "@/lib/i18n";
import { hapticSuccess } from "@/lib/haptics";

type Props = {
  onDismiss: () => void;
};

// Lightweight CSS confetti — no external dependency
const CONFETTI_COLORS = [
  "#10B981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    type Particle = {
      x: number; y: number;
      vx: number; vy: number;
      rot: number; vrot: number;
      w: number; h: number;
      color: string;
      life: number;
    };

    const particles: Particle[] = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.2,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      life: 1,
    }));

    let frame: number;
    let tick = 0;

    const draw = () => {
      tick++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.vy += 0.05; // gravity
        if (p.y > canvas.height * 0.7) p.life -= 0.02;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (tick < 180) {
        frame = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[60]"
    />
  );
}

export default function FirstRollCelebration({ onDismiss }: Props) {
  const { t } = useLocale();

  // Auto-dismiss after 6s
  useEffect(() => {
    hapticSuccess();
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  // ESC to dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <>
      <ConfettiCanvas />
      {/* Modal overlay */}
      <div
        role="presentation"
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-0 sm:px-6"
        onClick={onDismiss}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="bg-zinc-900 border border-[#10B981]/40 rounded-t-2xl sm:rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl shadow-[#10B981]/10 max-h-[85vh] overflow-y-auto"
        >
          <div className="text-5xl mb-4">🥋</div>
          <h2 className="text-xl font-bold text-white mb-2">
            {t("onboarding.firstRollTitle")}
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-6">
            {t("onboarding.firstRollDesc")}
          </p>
          <button type="button"
            onClick={onDismiss}
            className="w-full bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white font-semibold py-3 rounded-xl text-sm transition-all shadow-lg shadow-[#10B981]/25"
          >
            {t("onboarding.firstRollCta")}
          </button>
        </div>
      </div>
    </>
  );
}

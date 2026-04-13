"use client";

import { useEffect, useState, useRef } from "react";

// Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/**
 * #50: Easter Egg — Konami Code
 * Type ↑↑↓↓←→←→BA on keyboard to unlock the Black Belt achievement.
 */
export default function EasterEgg() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const key = e.key;
      const expected = KONAMI_CODE[progress];

      if (key === expected) {
        const next = progress + 1;
        if (next === KONAMI_CODE.length) {
          setShow(true);
          setProgress(0);
          timerRef.current = setTimeout(() => setShow(false), 5000);
        } else {
          setProgress(next);
        }
      } else {
        // Reset if wrong key, but allow restart from first key
        setProgress(key === KONAMI_CODE[0] ? 1 : 0);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [progress]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Easter egg: Black Belt unlocked"
      className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center p-6"
    >
      {/* Backdrop glow */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative text-center animate-bounce">
        <div className="text-7xl mb-4 drop-shadow-2xl">🥋</div>
        <div className="bg-slate-950/98 border border-pink-500/60 rounded-2xl px-8 py-7 shadow-2xl shadow-pink-500/30 max-w-xs mx-auto">
          <div className="text-xs font-bold tracking-[0.3em] text-pink-400 uppercase mb-2">
            Secret Unlocked
          </div>
          <div className="text-2xl font-black text-white mb-1 tracking-tight">
            BLACK BELT
          </div>
          <div className="text-slate-400 text-sm leading-relaxed mb-4">
            OSS! You found the hidden dojo.<br />Keep drilling. Keep tapping.
          </div>
          <div className="text-xl tracking-widest text-slate-500">
            ⬆⬆⬇⬇⬅➡⬅➡🅱🅰
          </div>
        </div>
      </div>
    </div>
  );
}

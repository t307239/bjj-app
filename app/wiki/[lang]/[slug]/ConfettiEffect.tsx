"use client";

import { useEffect, useRef } from "react";

/**
 * #34: Confetti on article completion
 * Fires a single burst of confetti when the CTA section scrolls into view
 * (indicating the user has read to the end of the article).
 * Pure canvas implementation — no external library needed.
 */
export default function ConfettiEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    // Target: the CTA banner at the bottom of the article
    const target = document.querySelector("[data-confetti-trigger]");
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          observer.disconnect();
          launchConfetti(canvasRef.current);
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-40"
      style={{ display: "none" }}
    />
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  angle: number;
  rotation: number;
}

function launchConfetti(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.style.display = "block";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = [
    "#ec4899", // pink-500
    "#a855f7", // purple-500
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#f97316", // orange-500
    "#ffffff",
  ];

  const particles: Particle[] = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 4 + 2,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 8 + 4,
    angle: Math.random() * Math.PI * 2,
    rotation: (Math.random() - 0.5) * 0.25,
  }));

  let frame = 0;
  const maxFrames = 200;

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.angle += p.rotation;

      // Fade out in last 40 frames
      const alpha = frame > maxFrames - 40
        ? Math.max(0, 1 - (frame - (maxFrames - 40)) / 40)
        : 1;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });

    frame++;
    if (frame < maxFrames) {
      requestAnimationFrame(animate);
    } else {
      canvas.style.display = "none";
    }
  };

  requestAnimationFrame(animate);
}

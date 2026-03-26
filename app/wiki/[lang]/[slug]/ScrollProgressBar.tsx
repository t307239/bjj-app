"use client";

import { useEffect, useState } from "react";

/**
 * #16: Scroll progress bar — fixed top, pink→purple gradient.
 * Renders a thin line that fills as the user scrolls.
 */
export default function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-[3px] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 transition-[width] duration-100"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

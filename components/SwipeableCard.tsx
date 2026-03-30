"use client";

/**
 * B-10: Swipe Delete/Edit wrapper (react-swipeable の代替・ネイティブタッチ)
 * 左スワイプ → 削除エリア (赤) / 右スワイプ → 編集エリア (緑)
 * threshold 60px でアクション確定。
 */
import { useRef, useState, useCallback } from "react";

type Props = {
  onDelete: () => void;
  onEdit: () => void;
  children: React.ReactNode;
  className?: string;
};

const THRESHOLD = 64;    // px — action trigger distance
const MAX_DRAG = 96;     // px — max visual offset

export default function SwipeableCard({ onDelete, onEdit, children, className = "" }: Props) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isHorizontal = useRef<boolean | null>(null); // determined on first meaningful move
  const [offsetX, setOffsetX] = useState(0);
  const [animating, setAnimating] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const x = e.touches[0].clientX;
    // Leave a 20px zone on the left edge for iOS back-swipe navigation
    if (x < 20) {
      touchStartX.current = null;
      return;
    }
    touchStartX.current = x;
    touchStartY.current = e.touches[0].clientY;
    isHorizontal.current = null;
    setAnimating(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Determine gesture direction on first significant movement
    if (isHorizontal.current === null && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal.current) return; // vertical scroll — don't interfere

    // Clamp drag range
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
    setOffsetX(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isHorizontal.current) return;
    const offset = offsetX;

    if (offset < -THRESHOLD) {
      // Committed left swipe → delete
      setAnimating(true);
      setOffsetX(-MAX_DRAG);
      setTimeout(() => {
        onDelete();
        setOffsetX(0);
        setAnimating(false);
      }, 180);
    } else if (offset > THRESHOLD) {
      // Committed right swipe → edit
      setAnimating(true);
      setOffsetX(MAX_DRAG);
      setTimeout(() => {
        onEdit();
        setOffsetX(0);
        setAnimating(false);
      }, 180);
    } else {
      // Snap back
      setAnimating(true);
      setOffsetX(0);
      setTimeout(() => setAnimating(false), 200);
    }
    touchStartX.current = null;
    touchStartY.current = null;
    isHorizontal.current = null;
  }, [offsetX, onDelete, onEdit]);

  const showDelete = offsetX < -12;
  const showEdit = offsetX > 12;
  const deleteIntensity = Math.min(1, Math.abs(offsetX) / THRESHOLD);
  const editIntensity = Math.min(1, offsetX / THRESHOLD);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Left action: Edit (right swipe reveals) */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-start pl-4 rounded-l-2xl"
        style={{
          width: MAX_DRAG,
          background: `rgba(16, 185, 129, ${showEdit ? editIntensity * 0.25 : 0})`,
          transition: animating ? "all 0.2s ease" : undefined,
        }}
      >
        {showEdit && (
          <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        )}
      </div>

      {/* Right action: Delete (left swipe reveals) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end pr-4 rounded-r-2xl"
        style={{
          width: MAX_DRAG,
          background: `rgba(239, 68, 68, ${showDelete ? deleteIntensity * 0.25 : 0})`,
          transition: animating ? "all 0.2s ease" : undefined,
        }}
      >
        {showDelete && (
          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
      </div>

      {/* Card content */}
      <div
        className={className}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: animating ? "transform 0.2s ease" : undefined,
          willChange: "transform",
          position: "relative",
          zIndex: 1,
          touchAction: "pan-y",  // iOS: allow vertical scroll, block horizontal browser gestures
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

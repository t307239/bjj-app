"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";

type Props = {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
  onUndo?: () => void;
};

export default function Toast({ message, type = "success", duration = 2500, onClose, onUndo }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all duration-300 flex items-center gap-3 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${
        type === "success"
          ? "bg-zinc-800 text-white border border-white/10"
          : "bg-red-500 text-white"
      }`}
    >
      <span>
        {type === "success" ? "✓ " : "✕ "}
        {message}
      </span>
      {onUndo && (
        <button
          onClick={() => {
            setVisible(false);
            onUndo();
          }}
          className="text-white font-bold text-xs underline underline-offset-2 hover:text-gray-300 transition-colors shrink-0"
        >
          Undo
        </button>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

type Props = {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export default function CollapsibleSection({ label, defaultOpen = true, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
        aria-expanded={isOpen}
      >
        <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
          {label}
        </span>
        <svg
          className={`w-3 h-3 text-zinc-700 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
          viewBox="0 0 12 12" fill="none"
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && <div className="space-y-3">{children}</div>}
    </section>
  );
}

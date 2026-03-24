"use client";

import { useState } from "react";

type Props = {
  label: string;
  defaultOpen?: boolean;
  contentHint?: string;
  children: React.ReactNode;
};

export default function CollapsibleSection({ label, defaultOpen = true, contentHint, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left mb-3 group min-h-[44px]"
        aria-expanded={isOpen}
      >
        <span className="text-[11px] font-semibold text-zinc-400 tracking-widest">
          {label}
        </span>
        {!isOpen && contentHint && (
          <span className="flex-1 text-[10px] text-zinc-700 truncate text-center px-2">
            {contentHint}
          </span>
        )}
        <span className="flex-1" />
        <svg
          className={`w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? "" : "-rotate-90"}`}
          viewBox="0 0 24 24" fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && <div className="space-y-3">{children}</div>}
    </section>
  );
}

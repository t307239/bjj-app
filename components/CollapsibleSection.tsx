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
        className="flex items-center justify-between w-full text-left mb-3 group min-h-[44px]"
        aria-expanded={isOpen}
      >
        <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">
          {label}
        </span>
        <svg
          className={`w-5 h-5 text-zinc-500 group-hover:text-zinc-400 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
          viewBox="0 0 24 24" fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && <div className="space-y-3">{children}</div>}
    </section>
  );
}

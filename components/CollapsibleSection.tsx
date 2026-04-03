"use client";

import { useState } from "react";

type Props = {
  label: string;
  defaultOpen?: boolean;
  contentHint?: string;
  cardTrigger?: boolean;
  children: React.ReactNode;
};

export default function CollapsibleSection({ label, defaultOpen = true, contentHint, cardTrigger = false, children }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="mb-8">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-2 w-full text-left group min-h-[44px] ${
          cardTrigger
            ? `p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl hover:bg-zinc-800/60 transition-colors ${isOpen ? "mb-3" : "mb-0"}`
            : "mb-3"
        }`}
        aria-expanded={isOpen}
      >
        <span className={`text-xs font-semibold tracking-widest ${cardTrigger ? "text-zinc-300" : "text-zinc-400"}`}>
          {label}
        </span>
        {!isOpen && contentHint && (
          <span className="flex-1 text-xs text-zinc-500 truncate text-center px-2">
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
      {/* CLS防御: grid rows transition で滑らかに展開/折畳み */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="space-y-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState, type ReactNode } from "react";

export interface Tab {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  tabs: Tab[];
  defaultTab?: string;
  children: (activeTab: string) => ReactNode;
  /** Extra element rendered to the right of tabs (e.g. settings gear icon) */
  trailing?: ReactNode;
}

/**
 * Reusable horizontal tab bar — sticky below NavBar.
 * Designed for Profile (3 tabs), Records (2 tabs), Techniques (3 tabs).
 */
export default function PageTabs({ tabs, defaultTab, children, trailing }: Props) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.key ?? "");

  return (
    <>
      {/* Tab bar */}
      <div className="sticky top-[56px] z-30 bg-zinc-950/95 backdrop-blur-md border-b border-white/8 -mx-4 px-4 mb-5">
        <div className="flex items-center gap-1">
          <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(tab.key)}
                className={`
                  flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors relative
                  ${active === tab.key
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                  }
                `}
              >
                {tab.icon && <span className="text-base">{tab.icon}</span>}
                {tab.label}
                {/* Active indicator */}
                {active === tab.key && (
                  <span className="absolute bottom-0 left-3.5 right-3.5 h-0.5 bg-emerald-400 rounded-full" />
                )}
              </button>
            ))}
          </div>
          {trailing && <div className="flex-shrink-0 pl-2">{trailing}</div>}
        </div>
      </div>

      {/* Tab content */}
      {children(active)}
    </>
  );
}

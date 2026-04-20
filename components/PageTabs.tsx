"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

export interface Tab {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  tabs: Tab[];
  defaultTab?: string;
  /** When set, reads/writes `?<urlParam>=<tab.key>` in the URL */
  urlParam?: string;
  children: (activeTab: string) => ReactNode;
  /** Extra element rendered to the right of tabs (e.g. settings gear icon) */
  trailing?: ReactNode;
}

/**
 * Reusable horizontal tab bar — sticky below NavBar.
 * Designed for Profile (3 tabs), Records (2 tabs), Techniques (3 tabs).
 * When `urlParam` is provided, the initial tab is read from the URL search params.
 */
export default function PageTabs({ tabs, defaultTab, urlParam, children, trailing }: Props) {
  const searchParams = useSearchParams();
  const validKeys = new Set(tabs.map((t) => t.key));
  const urlTab = urlParam ? searchParams.get(urlParam) : null;
  const initialTab = (urlTab && validKeys.has(urlTab) ? urlTab : null) ?? defaultTab ?? tabs[0]?.key ?? "";
  const [active, setActive] = useState(initialTab);

  // Sync if URL param changes externally (e.g. browser back/forward)
  useEffect(() => {
    if (!urlParam) return;
    const paramVal = searchParams.get(urlParam);
    if (paramVal && validKeys.has(paramVal) && paramVal !== active) {
      setActive(paramVal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, urlParam]);

  return (
    <>
      {/* Tab bar */}
      <div className="sticky z-30 bg-zinc-950/95 backdrop-blur-md border-b border-white/8 -mx-4 px-4 mb-5" style={{ top: "var(--navbar-height)" }}>
        <div className="flex items-center gap-1">
          <div className="flex-1 flex gap-1 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setActive(tab.key); trackEvent("tab_viewed", { tab: tab.key }); }}
                className={`
                  flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-all active:scale-95 relative
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

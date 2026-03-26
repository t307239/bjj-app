"use client";

import { useEffect } from "react";

interface TocItem {
  id: string;
  level: 2 | 3;
}

/**
 * #28: TOC Scroll Spy
 * Uses IntersectionObserver to detect which heading is in view,
 * then applies .toc-active class to the corresponding .toc-nav link.
 * Renders nothing — purely a DOM side-effect component.
 */
export default function TocScrollSpy({ items }: { items: TocItem[] }) {
  useEffect(() => {
    if (items.length === 0) return;

    const tocLinks = document.querySelectorAll<HTMLAnchorElement>(
      ".toc-nav a[href^='#']"
    );
    if (tocLinks.length === 0) return;

    let activeId = "";

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
          }
        });

        tocLinks.forEach((link) => {
          const href = link.getAttribute("href");
          if (href === `#${activeId}`) {
            link.classList.add("toc-active");
          } else {
            link.classList.remove("toc-active");
          }
        });
      },
      {
        // Trigger when heading enters the top 20% of the viewport
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      }
    );

    items.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  return null;
}

"use client";

/**
 * SiteFooter — z185: Global footer with cross-page links.
 *
 * Top app reference (Hevy / Notion / Linear minimal style):
 *   - Single row, no columns (mobile-friendly)
 *   - Key links: Pricing / Help / Wiki / Privacy / Terms
 *   - i18n locale-aware
 *   - subtle, not distracting (small text, muted color)
 *
 * Q-18: contact link (mailto) for support / press inquiries.
 */
import Link from "next/link";
import { useLocale } from "@/lib/i18n";

export default function SiteFooter() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  const links = [
    { href: "/pricing", label: t("nav.pricing") },
    { href: "/help", label: t("nav.help") },
    { href: "https://wiki.bjj-app.net", label: "BJJ Wiki", external: true },
    { href: "/privacy", label: t("nav.privacy") },
    { href: "/terms", label: t("nav.terms") },
  ];

  return (
    <footer className="border-t border-white/[0.06] mt-12 py-8 px-4 text-xs text-zinc-500">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-base">🥋</span>
          <span>BJJ App © {year}</span>
        </div>
        <nav className="flex items-center flex-wrap justify-center gap-x-4 gap-y-2">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-300 transition-colors"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-zinc-300 transition-colors"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </footer>
  );
}

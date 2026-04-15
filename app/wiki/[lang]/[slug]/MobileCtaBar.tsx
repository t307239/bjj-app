import Link from "next/link";

/**
 * #23: Mobile sticky CTA bar — fixed bottom, hidden on desktop (lg+).
 * Provides a persistent call-to-action on mobile without covering desktop sidebar.
 */
interface Props {
  href: string;
  cta: string;
}

export default function MobileCtaBar({ href, cta }: Props) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-white/10 bg-[#0f172a]/90 backdrop-blur-md px-4 py-3 pb-safe">
      <Link
        href={href}
        className="
          block w-full rounded-xl
          bg-pink-600 hover:bg-pink-500 active:bg-pink-700
          transition-colors
          py-3 text-sm font-bold text-white text-center
          shadow-lg
        "
      >
        {cta}
      </Link>
    </div>
  );
}

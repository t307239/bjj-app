"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "ホーム", icon: "🏠" },
  { href: "/techniques", label: "テクニック", icon: "📚" },
  { href: "/profile", label: "プロフィール", icon: "🏅" },
];

export default function NavBar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* デスクトップ/タブレット ヘッダー */}
      <header className="bg-[#16213e] border-b border-gray-700 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥋</span>
              <span className="font-bold text-lg">BJJ App</span>
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-[#e94560]/20 text-[#e94560]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-gray-300 text-sm hidden md:block">
              {displayName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* モバイル ボトムナビ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-[#16213e] border-t border-gray-700 z-50">
        <div className="grid grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                pathname === item.href
                  ? "text-[#e94560]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="text-xl leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

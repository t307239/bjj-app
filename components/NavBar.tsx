"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";
import LangToggle from "./LangToggle";
import { useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
};

export default function NavBar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [trainedToday, setTrainedToday] = useState<boolean | null>(null);

  useEffect(() => {
    const checkToday = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })();
      const { count } = await supabase
        .from("training_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("date", today);
      setTrainedToday((count ?? 0) > 0);
    };
    checkToday();
  }, [pathname]); // re-check after navigation (e.g. after logging a session)

  const NAV_ITEMS = [
    { href: "/dashboard", label: t("nav.home"), icon: "🏠" },
    { href: "/techniques", label: t("nav.techniques"), icon: "📚" },
    { href: "/profile", label: t("nav.profile"), icon: "🏅" },
  ];

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
                  className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-[#e94560]/20 text-[#e94560]"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                  {item.href === "/dashboard" && trainedToday === false && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#e94560] rounded-full" />
                  )}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
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
              className={`relative flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                pathname === item.href
                  ? "text-[#e94560]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <span className="relative text-xl leading-none">
                {item.icon}
                {item.href === "/dashboard" && trainedToday === false && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#e94560] rounded-full border border-[#16213e]" />
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

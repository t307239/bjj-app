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
  const [currentStreak, setCurrentStreak] = useState<number>(0);

  useEffect(() => {
    const checkToday = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const [{ count }, { data: recentLogs }] = await Promise.all([
        supabase
          .from("training_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("date", today),
        supabase
          .from("training_logs")
          .select("date")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(60),
      ]);
      setTrainedToday((count ?? 0) > 0);
      // ストリーク計算
      if (recentLogs && recentLogs.length > 0) {
        const uniqueDates = [...new Set(recentLogs.map((l: { date: string }) => l.date))].sort().reverse() as string[];
        let streak = 0;
        let checkDate = new Date(today);
        for (const dateStr of uniqueDates) {
          const check = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
          if (dateStr === check) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (dateStr < check) {
            break;
          }
        }
        setCurrentStreak(streak);
      }
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
      <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 sticky top-0 z-50">
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
            {currentStreak >= 2 && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                🔥 {currentStreak}日
              </span>
            )}
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
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-white/[0.08] z-50">
        {currentStreak >= 2 && (
          <div className="flex justify-center py-1 border-b border-white/5 bg-orange-500/5">
            <span className="text-[10px] text-orange-400">🔥 {currentStreak}日連続練習中</span>
          </div>
        )}
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
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[#e94560] rounded-full border border-zinc-900/80" />
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

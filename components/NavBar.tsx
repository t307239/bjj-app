"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/timezone";

const STRIPE_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";
const STRIPE_PORTAL_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL ?? "#";

type Props = {
  displayName: string;
  avatarUrl?: string | null;
};

export default function NavBar({ displayName, avatarUrl }: Props) {
  const pathname = usePathname();
  const [trainedToday, setTrainedToday] = useState<boolean | null>(null);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [isPro, setIsPro] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkToday = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const today = getLocalDateString();
      const [{ count }, { data: recentLogs }, { data: profile }] = await Promise.all([
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
        supabase
          .from("profiles")
          .select("is_pro")
          .eq("id", user.id)
          .single(),
      ]);
      setTrainedToday((count ?? 0) > 0);
      setIsPro(profile?.is_pro ?? false);
      // ストリーク計算
      if (recentLogs && recentLogs.length > 0) {
        const uniqueDates = [...new Set(recentLogs.map((l: { date: string }) => l.date))].sort().reverse() as string[];
        let streak = 0;
        let checkDateMs = new Date(today + "T00:00:00Z").getTime(); // UTCとして扱う
        for (const dateStr of uniqueDates) {
          const check = new Date(checkDateMs).toISOString().slice(0, 10);
          if (dateStr === check) {
            streak++;
            checkDateMs -= 86400000;
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
    { href: "/dashboard", label: "Home", icon: "🏠" },
    { href: "/techniques", label: "Techniques", icon: "📚" },
    { href: "/profile", label: "Profile", icon: "🏅" },
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
                  className={`relative px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    pathname === item.href
                      ? "border-white text-white"
                      : "border-transparent text-gray-300 hover:text-white"
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
                🔥 {currentStreak} days straight
              </span>
            )}
            {/* Pro Plan 導線 */}
            {isPro ? (
              <a
                href={STRIPE_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 text-[11px] text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                ✓ Pro · Manage
              </a>
            ) : (
              <a
                href={userId ? `${STRIPE_PAYMENT_LINK}?client_reference_id=${userId}` : STRIPE_PAYMENT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-3 py-1 rounded-lg text-xs transition-colors"
              >
                ⚡ Upgrade to Pro
              </a>
            )}
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full"
                title={displayName}
              />
            ) : (
              <span className="text-gray-300 text-sm hidden md:block max-w-[120px] truncate">
                {displayName}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* モバイル ボトムナビ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-white/[0.08] z-50">
        {currentStreak >= 2 && (
          <div className="flex justify-center py-1 border-b border-white/5 bg-orange-500/5">
            <span className="text-[10px] text-orange-400">🔥 {currentStreak} days straight</span>
          </div>
        )}
        <div className="grid grid-cols-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 py-3 text-xs transition-colors ${
                pathname === item.href
                  ? "text-white"
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

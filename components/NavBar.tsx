"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const NAV_ITEMS = [
    { href: "/dashboard", label: "Home", icon: "🏠" },
    { href: "/techniques", label: "Techniques", icon: "📚" },
    { href: "/profile", label: "Profile", icon: "🏅" },
  ];

  return (
    <>
      {/* デスクトップ/タブレット ヘッダー */}
      <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 py-3 sticky top-0 z-50">
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
            {currentStreak >= 30 ? (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                🔥 {currentStreak} days straight
              </span>
            ) : currentStreak >= 7 ? (
              <span className="hidden sm:flex items-center gap-1 text-[11px] text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                ⚡ {currentStreak} days
              </span>
            ) : null}
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
            {/* Avatar / display name with dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                aria-label="User menu"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-10 w-44 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-xs text-gray-400 truncate">{displayName}</p>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                    Profile
                  </Link>
                  <LogoutButton
                    onDone={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* モバイル ボトムナビ */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-xl border-t border-white/[0.08] z-50">
        {currentStreak >= 30 ? (
          <div className="flex justify-center py-1 border-b border-white/5 bg-orange-500/5">
            <span className="text-[10px] text-orange-400">🔥 {currentStreak} days straight</span>
          </div>
        ) : currentStreak >= 7 ? (
          <div className="flex justify-center py-1 border-b border-white/5 bg-orange-500/5">
            <span className="text-[10px] text-orange-400">⚡ {currentStreak} days</span>
          </div>
        ) : null}
        <div className="grid grid-cols-3 pb-safe">
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

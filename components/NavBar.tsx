"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";
import OfflineBanner from "./OfflineBanner";
import { useLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/timezone";
import { getLogicalTrainingDate } from "@/lib/logicalDate";

const STRIPE_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null;
const STRIPE_PORTAL_URL = process.env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL || null;

type Props = {
  displayName: string;
  avatarUrl?: string | null;
  isPro?: boolean;
};

export default function NavBar({ displayName, avatarUrl, isPro: isProProp }: Props) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [trainedToday, setTrainedToday] = useState<boolean | null>(null);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [isPro, setIsPro] = useState<boolean>(isProProp ?? false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkToday = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      // ⑨ Use logical training date: before 4AM counts as previous day
      const today = getLogicalTrainingDate();
      // 2 queries instead of 3: derive trainedToday from dates array (no separate count query)
      const [{ data: recentLogs }, { data: profile }] = await Promise.all([
        supabase
          .from("training_logs")
          .select("date")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(35), // 35 days covers any realistic streak
        supabase
          .from("profiles")
          .select("is_pro")
          .eq("id", user.id)
          .single(),
      ]);
      setTrainedToday((recentLogs ?? []).some((l: { date: string }) => l.date === today));
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
    { href: "/dashboard", label: t("nav.home"), icon: "🏠" },
    { href: "/techniques", label: t("nav.techniques"), icon: "📚" },
    { href: "/profile", label: t("nav.profile"), icon: "🏅" },
  ];

  return (
    <>
      <OfflineBanner />
      {/* デスクトップ/タブレット ヘッダー */}
      <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 py-3 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">🥋</span>
              <span className="font-bold text-lg">BJJ App</span>
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider text-emerald-400">BETA</span>
            </div>
            <nav className="hidden sm:flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`relative px-4 py-2 transition-colors ${
                    pathname === item.href
                      ? "text-sm font-semibold text-white after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-white after:rounded-t-full"
                      : "text-sm font-medium text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {currentStreak >= 30 ? (
              <span className="hidden sm:flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                {t("nav.streakBadge", { n: currentStreak })}
              </span>
            ) : currentStreak >= 7 ? (
              <span className="hidden sm:flex items-center gap-1 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                ⚡ {t("nav.streakDays", { n: currentStreak })}
              </span>
            ) : null}
            {/* Pro Plan 導線 */}
            {isPro ? (
              STRIPE_PORTAL_URL ? (
                <a
                  href={STRIPE_PORTAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  ✓ {t("nav.proManage")}
                </a>
              ) : (
                <span className="hidden sm:flex items-center gap-1 text-xs text-yellow-400">
                  ✓ {t("nav.proLabel")}
                </span>
              )
            ) : (
              STRIPE_PAYMENT_LINK ? (
                <a
                  href={userId ? `${STRIPE_PAYMENT_LINK}?client_reference_id=${userId}` : STRIPE_PAYMENT_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] active:scale-95 text-white font-bold px-3 py-1.5 rounded-full text-xs transition-all"
                >
                  ⚡ {t("nav.upgradeToPro")}
                </a>
              ) : (
                <span className="hidden sm:flex items-center gap-1 bg-zinc-700 text-gray-500 font-bold px-3 py-1 rounded-lg text-xs cursor-not-allowed" aria-disabled="true">
                  ⚡ {t("nav.upgradeToPro")}
                </span>
              )
            )}
            {/* Avatar / display name with dropdown */}
            <div ref={userMenuRef} className="relative">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                aria-label={t("common.userMenu")}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-semibold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                )}
                <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                    {t("nav.profile")}
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
            <span className="text-xs text-orange-400">{t("nav.streakBadge", { n: currentStreak })}</span>
          </div>
        ) : currentStreak >= 7 ? (
          <div className="flex justify-center py-1 border-b border-white/5 bg-orange-500/5">
            <span className="text-xs text-orange-400">⚡ {t("nav.streakDays", { n: currentStreak })}</span>
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
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

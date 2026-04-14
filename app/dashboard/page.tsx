import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import NavBar from "@/components/NavBar";
import GuestMigration from "@/components/GuestMigration";
import AchievementBadge from "@/components/AchievementBadge";
import InstallBanner from "@/components/InstallBanner";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import {
  getWeekStartDate,
  getMonthStartDate,
  getLocalDateParts,
} from "@/lib/timezone";
import { getLogicalTrainingDate } from "@/lib/logicalDate";
import { serverT, makeT, type Locale } from "@/lib/i18n";
import { calcBjjDuration, formatBjjDuration } from "@/lib/bjjDuration";
import ProStatusBanner from "@/components/ProStatusBanner";
import GuestDashboardClient from "@/components/GuestDashboardClient";
import Link from "next/link";

// ─── New simplified home components ──────────────────────────────────────────
import StatusBar from "@/components/dashboard/StatusBar";
import RecentLogs from "@/components/dashboard/RecentLogs";
import HeatmapCalendar from "@/components/dashboard/HeatmapCalendar";
import WeeklyReportCard from "@/components/WeeklyReportCard";
import CompetitionCountdown from "@/components/CompetitionCountdown";
import TechniqueFocusCard from "@/components/dashboard/TechniqueFocusCard";
import MatTimeTracker from "@/components/dashboard/MatTimeTracker";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: "Dashboard" };

  // perf: profile を単独 await → Promise.all 化して waterfall を解消
  const [{ data: profile }, { count: totalCount }, { data: recentLogsForStreak }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("belt, stripe, start_date")
        .eq("id", user.id)
        .single(),
      supabase
        .from("training_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("training_logs")
        .select("date")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .limit(60),
    ]);

  const belt = profile?.belt ?? "white";
  const count = totalCount ?? 0;
  const { totalMonths: months } = profile?.start_date
    ? calcBjjDuration(profile.start_date)
    : { totalMonths: 0 };
  const BELT_LABELS: Record<string, string> = {
    white: serverT("dashboard.beltWhite"),
    blue: serverT("dashboard.beltBlue"),
    purple: serverT("dashboard.beltPurple"),
    brown: serverT("dashboard.beltBrown"),
    black: serverT("dashboard.beltBlack"),
  };
  const beltLabel = BELT_LABELS[belt] ?? serverT("dashboard.beltWhite");

  let metaStreak = 0;
  const metaToday = getLogicalTrainingDate();
  if (recentLogsForStreak && recentLogsForStreak.length > 0) {
    const uniqueDates = [
      ...new Set(recentLogsForStreak.map((l: { date: string }) => l.date)),
    ].sort().reverse() as string[];
    let checkDateMs = new Date(metaToday + "T00:00:00Z").getTime();
    for (const dateStr of uniqueDates) {
      const check = new Date(checkDateMs).toISOString().slice(0, 10);
      if (dateStr === check) {
        metaStreak++;
        checkDateMs -= 86400000;
      } else if (dateStr < check) {
        break;
      }
    }
  }

  const ogImageUrl = `${BASE_URL}/api/og?belt=${belt}&count=${count}&months=${months}&streak=${metaStreak}`;
  const title = `BJJ Training Log — ${count} Sessions! | BJJ App`;
  const bjjDurLabel = profile?.start_date ? formatBjjDuration(profile.start_date, serverT) : null;
  const description = bjjDurLabel
    ? `${beltLabel} · ${count} total sessions · ${bjjDurLabel} of BJJ — tracking every roll with BJJ App`
    : `${beltLabel} · ${count} total sessions — tracking every roll with BJJ App`;

  return {
    title: count > 0 ? `Dashboard — ${count} sessions` : "Dashboard",
    openGraph: {
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: "BJJ App Training Record",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ welcome?: string }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const isWelcomeRedirect = resolvedParams?.welcome === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <GuestDashboardClient />;

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    serverT("dashboard.defaultAthleteName");
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture;

  const firstDayOfMonth = getMonthStartDate();
  const firstDayOfWeek = getWeekStartDate();
  const { year, month } = getLocalDateParts();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const firstDayOfPrevMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;

  // ── 全データを並列フェッチ ──
  // Heatmap needs 112 days (16 weeks) of training dates
  const heatmapStartDate = (() => {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
    d.setDate(d.getDate() - 112);
    return d.toISOString().slice(0, 10);
  })();

  const [
    { data: profileData },
    rpcRes,
    { data: recentLogs },
    { data: recentLogsFull },
    { data: heatmapLogs },
    { count: techniqueCount },
    { data: pinnedTechniques },
    { data: allDurations },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "belt, stripe, start_date, is_pro, subscription_status, locale, weekly_goal, monthly_goal, technique_goal"
      )
      .eq("id", user.id)
      .single(),
    supabase.rpc("get_dashboard_metrics", {
      p_user_id: user.id,
      p_month_start: firstDayOfMonth,
      p_prev_month_start: firstDayOfPrevMonth,
      p_week_start: firstDayOfWeek,
    }),
    supabase
      .from("training_logs")
      .select("date")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(60),
    // Fetch recent 3 full entries for the compact home view
    supabase
      .from("training_logs")
      .select("id, date, type, duration_min, notes")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(3),
    // Heatmap: all dates in last 112 days
    supabase
      .from("training_logs")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", heatmapStartDate)
      .order("date", { ascending: false }),
    // Technique count for onboarding checklist
    supabase
      .from("techniques")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    // Pinned techniques for focus card
    supabase
      .from("techniques")
      .select("id, name, category, mastery_level")
      .eq("user_id", user.id)
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(5),
    // All durations for 10K hour tracker (lightweight — just one int column)
    supabase
      .from("training_logs")
      .select("duration_min")
      .eq("user_id", user.id),
  ]);

  let metrics = rpcRes.data;
  if (!metrics || (Array.isArray(metrics) && metrics.length === 0)) {
    const [mRes, wRes, totRes] = await Promise.all([
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfMonth),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id).gte("date", firstDayOfWeek),
      supabase.from("training_logs").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    ]);
    metrics = [{
      month_count: mRes.count ?? 0,
      week_count: wRes.count ?? 0,
      total_count: totRes.count ?? 0,
    }];
  }

  const m = Array.isArray(metrics) ? metrics[0] : metrics;
  const monthCount = Number(m?.month_count ?? 0);
  const weekCount = Number(m?.week_count ?? 0);
  const totalCount = Number(m?.total_count ?? 0);

  // ── Locale-aware translation for page body (metadata stays EN for SEO) ──
  // Priority: bjj_locale cookie → profile.locale (ja only) → Accept-Language → "en"
  // NOTE: pt disabled on server — pt.json is ~18% complete, would show mixed pt/en
  let userLocale: Locale = "en";
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("bjj_locale")?.value;
  if (cookieLocale === "ja") {
    userLocale = "ja";
  } else {
    const profileLocale = (profileData as { locale?: string | null })?.locale;
    if (profileLocale === "ja") {
      userLocale = "ja";
    } else {
      const hdrs = await headers();
      const acceptLang = hdrs.get("accept-language") ?? "";
      if (acceptLang.toLowerCase().startsWith("ja")) userLocale = "ja";
    }
  }
  const t = makeT(userLocale);

  const isPro = profileData?.is_pro ?? false;
  const subscriptionStatus = profileData?.subscription_status ?? "active";
  const hasFirstLog = totalCount > 0;

  // ── Onboarding state ──
  const hasGoal = ((profileData as { weekly_goal?: number } | null)?.weekly_goal ?? 0) > 0
    || ((profileData as { monthly_goal?: number } | null)?.monthly_goal ?? 0) > 0
    || ((profileData as { technique_goal?: number } | null)?.technique_goal ?? 0) > 0;
  const hasTechnique = (techniqueCount ?? 0) > 0;
  const onboardingComplete = hasFirstLog && hasGoal && hasTechnique;

  // Calculate streak (same algorithm as NavBar — uses logical training date)
  const todayStr = getLogicalTrainingDate();
  let streak = 0;
  if (recentLogs && recentLogs.length > 0) {
    const uniqueDates = [
      ...new Set(recentLogs.map((l: { date: string }) => l.date)),
    ].sort().reverse() as string[];
    let checkDateMs = new Date(todayStr + "T00:00:00Z").getTime();
    for (const dateStr of uniqueDates) {
      const check = new Date(checkDateMs).toISOString().slice(0, 10);
      if (dateStr === check) {
        streak++;
        checkDateMs -= 86400000;
      } else if (dateStr < check) {
        break;
      }
    }
  }

  // ── Focus techniques (pinned) ──
  const focusTechniques = (pinnedTechniques ?? []) as {
    id: string;
    name: string;
    category: string | null;
    mastery_level: number;
  }[];
  // Count this week's sessions that mention focus technique names in notes
  const focusWeekPractice = focusTechniques.length > 0
    ? (recentLogsFull ?? []).filter((log: { date: string; notes: string | null }) => {
        if (!log.notes || log.date < firstDayOfWeek) return false;
        const lower = log.notes.toLowerCase();
        return focusTechniques.some((ft) => lower.includes(ft.name.toLowerCase()));
      }).length
    : 0;

  // ── 10,000 hour tracker ──
  const totalMinutes = (allDurations ?? []).reduce(
    (sum: number, row: { duration_min: number }) => sum + (row.duration_min ?? 0),
    0
  );
  // Weekly average: total minutes / weeks since start_date (or total count / 4 as fallback)
  const startDate = profileData?.start_date;
  const weeklyAvgMinutes = (() => {
    if (totalMinutes <= 0) return 0;
    if (startDate) {
      const startMs = new Date(startDate + "T00:00:00Z").getTime();
      const nowMs = Date.now() + 9 * 60 * 60 * 1000; // JST
      const weeksElapsed = Math.max(1, (nowMs - startMs) / (7 * 86400000));
      return totalMinutes / weeksElapsed;
    }
    // Fallback: assume ~4 weeks of data
    return totalMinutes / 4;
  })();

  // Typed recent logs for compact home view
  const typedRecentLogs = (recentLogsFull ?? []) as {
    id: string;
    date: string;
    type: string;
    duration_min: number;
    notes: string | null;
  }[];

  // Heatmap training dates (array of date strings)
  const heatmapDates = (heatmapLogs ?? []).map((l: { date: string }) => l.date);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 pb-20 sm:pb-0">
      <InstallBanner />
      <NavBar displayName={displayName} avatarUrl={avatarUrl} isPro={isPro} />
      <ProStatusBanner subscriptionStatus={subscriptionStatus} />
      <GuestMigration userId={user.id} />
      <AchievementBadge userId={user.id} totalCount={totalCount ?? 0} />

      <main className="max-w-4xl mx-auto px-4 py-5">

        {/* ── Onboarding checklist (until all steps complete) ── */}
        {!onboardingComplete && (
          <OnboardingChecklist
            hasFirstLog={hasFirstLog}
            hasGoal={hasGoal}
            hasTechnique={hasTechnique}
          />
        )}

        {/* ═══════════════════════════════════════════
            STATUS BAR — compact 1-line stats overview
            Replaces HeroCard + BentoStatsGrid
            ═══════════════════════════════════════════ */}
        <StatusBar
          weekCount={weekCount}
          monthCount={monthCount}
          streak={streak}
          totalCount={totalCount}
          bjjDuration={profileData?.start_date ? formatBjjDuration(profileData.start_date, t) : null}
          t={t}
        />

        {/* ═══════════════════════════════════════════
            QUICK ACTION — prominent record CTA (desktop)
            ═══════════════════════════════════════════ */}
        <Link
          href="/records"
          className="hidden md:flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-2xl px-5 py-4 mb-5 transition-all group active:scale-[0.98]"
        >
          <div className="w-11 h-11 rounded-xl bg-[#10B981] flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
              {t("home.quickActionTitle")}
            </p>
            <p className="text-xs text-zinc-400">
              {t("home.quickActionDesc")}
            </p>
          </div>
          <svg className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>

        {/* ═══════════════════════════════════════════
            HEATMAP CALENDAR — GitHub-style training activity
            ═══════════════════════════════════════════ */}
        {hasFirstLog && (
          <HeatmapCalendar trainingDates={heatmapDates} />
        )}

        {/* ═══════════════════════════════════════════
            MAT TIME TRACKER — 10,000 hour progress
            ═══════════════════════════════════════════ */}
        {hasFirstLog && (
          <MatTimeTracker
            totalMinutes={totalMinutes}
            weeklyAvgMinutes={weeklyAvgMinutes}
            t={t}
          />
        )}

        {/* ═══════════════════════════════════════════
            TECHNIQUE FOCUS — pinned techniques as weekly focus
            ═══════════════════════════════════════════ */}
        <TechniqueFocusCard
          techniques={focusTechniques}
          weekPracticeCount={focusWeekPractice}
          t={t}
        />

        {/* ═══════════════════════════════════════════
            COMPETITION COUNTDOWN — upcoming competitions + AI training recs
            ═══════════════════════════════════════════ */}
        <CompetitionCountdown userId={user.id} isPro={isPro} />

        {/* ═══════════════════════════════════════════
            WEEKLY REPORT — Pro auto-generated performance report
            ═══════════════════════════════════════════ */}
        {hasFirstLog && (
          <WeeklyReportCard userId={user.id} isPro={isPro} />
        )}

        {/* ═══════════════════════════════════════════
            RECENT LOGS — last 3 entries, compact
            ═══════════════════════════════════════════ */}
        <RecentLogs logs={typedRecentLogs} weekCount={weekCount} streak={streak} t={t} />

        {/* ═══════════════════════════════════════════
            PRO INSIGHT TEASER (free users only)
            ═══════════════════════════════════════════ */}
        {!isPro && hasFirstLog && (
          <Link
            href="/profile#upgrade"
            className="block bg-zinc-900/40 border border-amber-500/10 hover:border-amber-500/30 rounded-2xl px-4 py-3.5 mb-5 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-300">
                  {t("home.proInsightTeaser")}
                </p>
                <p className="text-xs text-amber-500/70 mt-0.5 group-hover:text-amber-400 transition-colors">
                  {t("home.proInsightDesc")}
                </p>
              </div>
              <svg className="w-4 h-4 text-amber-500/50 group-hover:text-amber-400 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        )}

        {/* ═══════════════════════════════════════════
            RECORD FAB — always visible on mobile
            ═══════════════════════════════════════════ */}
        <Link
          href="/records"
          className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-[#10B981] hover:bg-[#0d9668] active:scale-95 text-white text-2xl font-bold rounded-full shadow-lg shadow-[#10B981]/40 transition-all flex items-center justify-center"
          aria-label={t("training.add")}
        >
          +
        </Link>

      </main>
    </div>
  );
}

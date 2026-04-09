"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import PersonalBests from "./PersonalBests";
import ProfileForm from "./ProfileForm";
import ReferralSection from "./ReferralSection";
import PushNotificationSection from "./PushNotificationSection";
import CsvExport from "./CsvExport";
import ProGate from "./ProGate";
import MilestoneBadgeGrid from "./MilestoneBadgeGrid";
import { trackEvent } from "@/lib/analytics";

// perf: タブ切り替え時に初めて必要になるコンポーネントを遅延読み込み
// stats タブの重いチャート・分析カードと body タブのキャンバス系を初期バンドルから除外
const TrainingChart = dynamic(() => import("./TrainingChart"), {
  ssr: false,
  loading: () => <div className="h-48 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const RollAnalyticsCard = dynamic(() => import("./RollAnalyticsCard"), {
  ssr: false,
  loading: () => <div className="h-36 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const PartnerStatsCard = dynamic(() => import("./PartnerStatsCard"), {
  ssr: false,
  loading: () => <div className="h-36 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const ExtendedBadgeGrid = dynamic(() => import("./ExtendedBadgeGrid"), {
  ssr: false,
  loading: () => <div className="h-48 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const BodyManagementSection = dynamic(() => import("./BodyManagementSection"), {
  ssr: false,
  loading: () => <div className="h-48 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const TrainingBarChart = dynamic(() => import("./TrainingBarChart"), {
  ssr: false,
  loading: () => <div className="h-36 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});
const TrainingTypeChart = dynamic(() => import("./TrainingTypeChart"), {
  ssr: false,
  loading: () => <div className="h-36 bg-zinc-900/50 border border-white/8 rounded-2xl animate-pulse" />,
});

function AccountSection({ userId, isPro, referralCode, referralCount }: { userId: string; isPro: boolean; referralCode: string | null; referralCount: number }) {
  const { t } = useLocale();
  const supabase = createClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        console.error("account.delete failed", json.error);
        setDeleting(false);
        return;
      }
    } catch {
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/?deleted=1");
  };

  return (
    <div className="space-y-4">
      {/* Referral section — invite friends */}
      {referralCode && (
        <ReferralSection referralCode={referralCode} referralCount={referralCount} />
      )}

      {/* B2B lead card — always show to non-gym-owners; drive them to /gym */}
      {!isPro && (
        <div className="bg-zinc-900 border border-blue-500/20 rounded-xl px-4 py-4 mt-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🥋</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">{t("profile.gymLeadTitle")}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{t("profile.gymLeadDesc")}</p>
            </div>
          </div>
          <a
            href="/gym"
            onClick={() => trackEvent("gym_lead_click")}
            className="mt-3 block w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm text-center transition-colors active:scale-95"
          >
            {t("profile.gymLeadCta")}
          </a>
        </div>
      )}

      {/* ⚙ App Settings — Push Notifications */}
      <PushNotificationSection />
      <div className="rounded-xl border border-red-900/50 overflow-hidden">
        <div className="bg-red-950/30 px-5 py-3 border-b border-red-900/30">
          <h3 className="text-red-500 text-sm font-semibold">{t("profile.dangerZone")}</h3>
        </div>
        <div className="bg-zinc-900 px-5 py-4">
          {!confirm ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">{t("profile.deleteAccount")}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{t("profile.deleteWarning")}</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirm(true)}
                className="flex-shrink-0 px-4 py-1.5 rounded-lg border border-red-700/60 text-red-400 hover:bg-red-900/30 hover:border-red-600 text-sm font-medium transition-colors active:scale-95"
              >
                {t("profile.deleteAccount")}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Title row + CSV export inline */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-red-400 text-sm font-semibold">{t("profile.deleteTitle")}</p>
                <CsvExport userId={userId} />
              </div>
              <p className="text-zinc-400 text-xs">{t("profile.deleteDesc")}</p>
              {/* Type DELETE to confirm */}
              <div>
                <label className="block text-xs text-zinc-500 mb-1">{t("profile.deleteTypeLabel")}</label>
                <input
                  type="text"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder={t("profile.deleteTypePlaceholder")}
                  aria-label={t("profile.ariaDeleteInput")}
                  className="w-full bg-zinc-800 border border-red-900/50 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || deleteInput !== "DELETE"}
                  aria-label={t("profile.ariaDeleteConfirm")}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-sm transition-colors active:scale-95"
                >
                  {deleting ? t("profile.deleting") : t("profile.deleteAccountPermanently")}
                </button>
                <button
                  type="button"
                  onClick={() => { setConfirm(false); setDeleteInput(""); }}
                  className="flex-1 bg-white/10 hover:bg-white/15 text-zinc-300 font-bold py-2 rounded-lg text-sm transition-colors active:scale-95"
                >
                  {t("training.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type TabId = "stats" | "profile" | "body" | "account";
type ActivityTab = "calendar" | "monthly" | "type";
type BadgeTab = "milestones" | "badges";

// perf: タブにホバー/フォーカスした時点でチャンクを先読みしておく
// → クリック時には既にロード済みになりスケルトンが出ない
const PRELOAD_MAP: Partial<Record<TabId, () => void>> = {
  stats:   () => { void import("./RollAnalyticsCard"); void import("./PartnerStatsCard"); void import("./ExtendedBadgeGrid"); void import("./TrainingBarChart"); void import("./TrainingTypeChart"); },
  body:    () => { void import("./BodyManagementSection"); },
  profile: () => { void import("./ProfileForm"); },
};

const VALID_TABS: TabId[] = ["stats", "profile", "body", "account"];

export default function ProfileTabs({ userId, isPro = false, referralCode = null, referralCount = 0, totalCount = 0, belt = "white", stripeCount = 0, monthsAtBelt = 0 }: { userId: string; isPro?: boolean; referralCode?: string | null; referralCount?: number; totalCount?: number; belt?: string; stripeCount?: number; monthsAtBelt?: number }) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const [activityTab, setActivityTab] = useState<ActivityTab>("calendar");
  const [badgeTab, setBadgeTab] = useState<BadgeTab>("milestones");

  // URLパラメータ(?tab=body等)を初回マウント後に読んで初期化
  // useSearchParams は Suspense 必須で dynamic import と干渉するため
  // window.location.search を useEffect で読む方式を採用
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab") as TabId | null;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);
  const TABS: { id: TabId; label: string }[] = [
    { id: "stats",   label: t("profile.tabs.stats") },
    { id: "profile", label: t("profile.tabs.profile") },
    { id: "body",    label: t("profile.tabs.body") },
    { id: "account", label: t("profile.tabs.settings") },
  ];

  return (
    <div>
      {/* sticky tab bar — stays below NavBar (top-[52px]) while scrolling */}
      <div className="sticky top-[52px] z-40 -mx-4 sm:mx-0 px-4 sm:px-0 pt-2 pb-2 mb-4 bg-zinc-950/95 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex bg-zinc-900/80 p-1 rounded-lg">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); trackEvent("tab_viewed", { tab: tab.id }); }}
              onMouseEnter={() => PRELOAD_MAP[tab.id]?.()}
              onFocus={() => PRELOAD_MAP[tab.id]?.()}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all active:scale-95 ${
                activeTab === tab.id
                  ? "bg-zinc-700 text-white shadow-sm font-medium"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === "stats"   && (
        <>
          {/* S-1: 個人記録（コラプシブル） */}
          <PersonalBests userId={userId} />

          {/* S-2: アクティビティ — カレンダーヒートマップを直接表示 */}
          <div className="mt-4">
            <TrainingChart userId={userId} isPro={isPro} />
            {/* 詳細チャート（月別/タイプ）は折りたたみ */}
            {showDetailCharts && (
              <div className="mt-3 space-y-3">
                <TrainingBarChart userId={userId} isPro={isPro} />
                <TrainingTypeChart userId={userId} isPro={isPro} />
              </div>
            )}
            <button
              onClick={() => setShowDetailCharts((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <span>{showDetailCharts ? t("profile.hideDetailCharts") : t("profile.showDetailCharts")}</span>
              <svg className={`w-3.5 h-3.5 transition-transform ${showDetailCharts ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* S-3: 実績 — マイルストーンを直接表示 */}
          <MilestoneBadgeGrid totalCount={totalCount} />
          {showExtendedBadges && (
            <div className="mt-3">
              <ExtendedBadgeGrid userId={userId} />
            </div>
          )}
          <button
            onClick={() => setShowExtendedBadges((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>{showExtendedBadges ? t("profile.hideExtendedBadges") : t("profile.showExtendedBadges")}</span>
            <svg className={`w-3.5 h-3.5 transition-transform ${showExtendedBadges ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* S-4: 高度な分析 — ロール分析・パートナー統計を1 ProGate に統合 */}
          <div className="mt-4">
            <ProGate isPro={isPro} feature="ロール分析 & パートナー統計" userId={userId}>
              <div className="space-y-4">
                <RollAnalyticsCard userId={userId} />
                <PartnerStatsCard userId={userId} />
              </div>
            </ProGate>
          </div>
        </>
      )}
      {activeTab === "profile" && <ProfileForm userId={userId} hideAccount />}
      {activeTab === "body"    && <BodyManagementSection userId={userId} isPro={isPro} />}
      {activeTab === "account" && <AccountSection userId={userId} isPro={isPro} referralCode={referralCode} referralCount={referralCount} />}
    </div>
  );
}

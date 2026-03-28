"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import PersonalBests from "./PersonalBests";
import ProfileForm from "./ProfileForm";
import BodyManagementSection from "./BodyManagementSection";
import TrainingChart from "./TrainingChart";
import ReferralSection from "./ReferralSection";

function AccountSection({ userId, isPro, referralCode, referralCount }: { userId: string; isPro: boolean; referralCode: string | null; referralCount: number }) {
  const { t } = useLocale();
  const supabase = createClient();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from("training_logs").delete().eq("user_id", userId);
    await supabase.from("techniques").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("id", userId);
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
            className="mt-3 block w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm text-center transition-colors active:scale-95"
          >
            {t("profile.gymLeadCta")}
          </a>
        </div>
      )}

      {/* ㉘ App Settings — intentional empty state with dashed border */}
      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <h3 className="text-zinc-500 text-sm font-semibold mb-2">{t("profile.appSettings")}</h3>
        <p className="text-zinc-500 text-xs">{t("profile.settingsSoon")}</p>
      </div>
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
            <div>
              <p className="text-red-400 text-sm font-semibold mb-1">{t("profile.deleteConfirm")}</p>
              <p className="text-zinc-400 text-xs mb-4">{t("profile.deleteWarning")}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm transition-colors active:scale-95"
                >
                  {deleting ? t("profile.deleting") : t("profile.deleteConfirmYes")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
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

export default function ProfileTabs({ userId, isPro = false, referralCode = null, referralCount = 0 }: { userId: string; isPro?: boolean; referralCode?: string | null; referralCount?: number }) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const TABS: { id: TabId; label: string }[] = [
    { id: "stats",   label: t("profile.tabs.stats") },
    { id: "profile", label: t("profile.tabs.profile") },
    { id: "body",    label: t("profile.tabs.body") },
    { id: "account", label: t("profile.tabs.settings") },
  ];

  return (
    <div>
      <div className="flex bg-zinc-900/80 p-1 rounded-lg mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
      {activeTab === "stats"   && (
        <>
          <PersonalBests userId={userId} />
          {/* Training calendar heatmap (moved from Dashboard ③-4) */}
          <div className="mt-6">
            <TrainingChart userId={userId} isPro={isPro} />
          </div>
        </>
      )}
      {activeTab === "profile" && <ProfileForm userId={userId} hideAccount />}
      {activeTab === "body"    && <BodyManagementSection userId={userId} />}
      {activeTab === "account" && <AccountSection userId={userId} isPro={isPro} referralCode={referralCode} referralCount={referralCount} />}
    </div>
  );
}

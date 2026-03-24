"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import PersonalBests from "./PersonalBests";
import ProfileForm from "./ProfileForm";

function AccountSection({ userId }: { userId: string }) {
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
      {/* ㉘ App Settings — intentional empty state with dashed border */}
      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center mt-4">
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
                <p className="text-xs text-zinc-500 mt-0.5">{t("profile.deleteWarning")}</p>
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

type TabId = "stats" | "profile" | "account";

export default function ProfileTabs({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const TABS: { id: TabId; label: string }[] = [
    { id: "stats", label: t("profile.tabs.stats") },
    { id: "profile", label: t("profile.tabs.profile") },
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
      {activeTab === "stats" && <PersonalBests userId={userId} />}
      {activeTab === "profile" && <ProfileForm userId={userId} hideAccount />}
      {activeTab === "account" && <AccountSection userId={userId} />}
    </div>
  );
}

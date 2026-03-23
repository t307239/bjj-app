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
      <div className="bg-zinc-900 rounded-xl p-5 border border-white/10">
        <h3 className="text-gray-400 text-sm font-semibold mb-3">{t("profile.appSettings")}</h3>
        <p className="text-gray-600 text-xs">{t("profile.settingsSoon")}</p>
      </div>
      <div className="bg-zinc-900 rounded-xl p-5 border border-red-900/30">
        <h3 className="text-red-500/70 text-xs uppercase tracking-wider mb-3">{t("profile.dangerZone")}</h3>
        {!confirm ? (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="text-red-500 hover:text-red-400 text-sm underline"
          >
            {t("profile.deleteAccount")}
          </button>
        ) : (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
            <p className="text-red-400 text-sm font-semibold mb-1">{t("profile.deleteConfirm")}</p>
            <p className="text-gray-400 text-xs mb-4">
              {t("profile.deleteWarning")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm"
              >
                {deleting ? t("profile.deleting") : t("profile.deleteConfirmYes")}
              </button>
              <button
                type="button"
                onClick={() => setConfirm(false)}
                className="flex-1 bg-white/10 hover:bg-white/15 text-gray-300 font-bold py-2 rounded-lg text-sm"
              >
                {t("training.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type TabId = "stats" | "profile" | "account";

export default function ProfileTabs({ userId }: { userId: string }) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<TabId>("stats");
  const TABS: { id: TabId; label: string }[] = [
    { id: "stats", label: `📊 ${t("profile.tabs.stats")}` },
    { id: "profile", label: `✏️ ${t("profile.tabs.profile")}` },
    { id: "account", label: `⚙️ ${t("profile.tabs.settings")}` },
  ];

  return (
    <div>
      <div className="flex gap-1 bg-zinc-900 rounded-xl p-1 mb-6 border border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-zinc-600 text-white shadow"
                : "text-gray-400 hover:text-white"
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

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";
import ReferralSection from "@/components/ReferralSection";
import PushNotificationSection from "@/components/PushNotificationSection";
import CsvExport from "@/components/CsvExport";
import { trackEvent } from "@/lib/analytics";

interface Props {
  userId: string;
  isPro: boolean;
  referralCode: string | null;
  referralCount: number;
}

export default function SettingsSection({
  userId,
  isPro,
  referralCode,
  referralCount,
}: Props) {
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
    <div className="space-y-3">
      {/* Section header */}
      <p className="text-xs font-semibold text-zinc-400 tracking-widest uppercase mt-1">
        {t("profile.tabs.settings")}
      </p>

      {/* Referral section — invite friends */}
      {referralCode && (
        <ReferralSection
          referralCode={referralCode}
          referralCount={referralCount}
        />
      )}

      {/* B2B lead card — always show to non-gym-owners; drive them to /gym */}
      {!isPro && (
        <div className="bg-zinc-900 border border-blue-500/20 rounded-xl px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🥋</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {t("profile.gymLeadTitle")}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                {t("profile.gymLeadDesc")}
              </p>
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

      {/* Push Notifications */}
      <PushNotificationSection />

      {/* Data Export */}
      <div className="bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white">
            {t("profile.exportDataTitle")}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
            {t("profile.exportDataHint")}
          </p>
        </div>
        <div className="flex-shrink-0">
          <CsvExport userId={userId} />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-900/50 overflow-hidden">
        <div className="bg-red-950/30 px-5 py-3 border-b border-red-900/30">
          <h3 className="text-red-500 text-sm font-semibold">
            {t("profile.dangerZone")}
          </h3>
        </div>
        <div className="bg-zinc-900 px-5 py-3">
          {!confirm ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">
                  {t("profile.deleteAccount")}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {t("profile.deleteWarning")}
                </p>
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-red-400 text-sm font-semibold">
                  {t("profile.deleteTitle")}
                </p>
                <CsvExport userId={userId} />
              </div>
              <p className="text-zinc-400 text-xs">{t("profile.deleteDesc")}</p>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  {t("profile.deleteTypeLabel")}
                </label>
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
                  {deleting
                    ? t("profile.deleting")
                    : t("profile.deleteAccountPermanently")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(false);
                    setDeleteInput("");
                  }}
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

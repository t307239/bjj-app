"use client";

import { useState, useEffect } from "react";
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

  // Detect user's timezone from browser (client-only to avoid hydration mismatch)
  const [tzInfo, setTzInfo] = useState<{ zone: string; short: string; utc: string } | null>(null);
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const offsetMinutes = -now.getTimezoneOffset();
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60);
    const offsetMins = Math.abs(offsetMinutes) % 60;
    const utcSign = offsetMinutes >= 0 ? "+" : "-";
    const utc = `UTC${utcSign}${offsetHours}${offsetMins > 0 ? `:${String(offsetMins).padStart(2, "0")}` : ""}`;
    const short = now.toLocaleTimeString([], { timeZoneName: "short" }).split(" ").pop() ?? "";
    setTzInfo({ zone, short, utc });
  }, []);

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

      {/* Timezone Display */}
      <div className="bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-white">
            {t("profile.timezone")}
          </p>
        </div>
        {tzInfo ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            {tzInfo.zone} ({tzInfo.short}, {tzInfo.utc})
          </p>
        ) : (
          <p className="text-xs text-zinc-500 leading-relaxed">—</p>
        )}
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          {t("profile.timezoneDesc")}
        </p>
      </div>

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
      {/* §18 Brand: Data ownership trust signal */}
      <p className="text-xs text-zinc-500 px-1">
        {t("profile.dataOwnership")}
      </p>

      {/* Help & Support */}
      <a
        href="/help"
        className="flex items-center justify-between bg-zinc-900/60 border border-white/8 rounded-xl px-4 py-3 hover:bg-white/[0.04] transition-colors group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">
              {t("help.title")}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {t("profile.helpDesc")}
            </p>
          </div>
        </div>
        <svg className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </a>

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

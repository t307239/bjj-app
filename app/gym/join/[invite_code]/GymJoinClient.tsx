"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n";

type Props = {
  gymId: string;
  gymName: string;
  ownerName: string;
  maskedEmail: string;
  currentGymId: string | null;
  inviteCode: string;
};

export default function GymJoinClient({
  gymId,
  gymName,
  ownerName,
  maskedEmail,
  currentGymId,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const { t } = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransferWarning, setShowTransferWarning] = useState(false);

  const handleJoin = async (shareData: boolean) => {
    // If already in another gym, confirm transfer first
    if (currentGymId && !showTransferWarning) {
      setShowTransferWarning(true);
      return;
    }
    await performJoin(shareData);
  };

  const performJoin = async (shareData: boolean) => {
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        gym_id: gymId,
        share_data_with_gym: shareData,
      })
      .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");

    if (updateError) {
      setError(t("gymJoin.error"));
      setLoading(false);
      return;
    }
    router.push("/dashboard?gym_joined=1");
  };

  // Transfer warning screen
  if (showTransferWarning) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
          <div className="text-3xl mb-3 text-center">⚠️</div>
          <h2 className="text-lg font-bold text-white text-center mb-2">{t("gymJoin.transferTitle")}</h2>
          <p className="text-sm text-gray-400 text-center mb-5">
            {t("gymJoin.transferDesc", { name: gymName })}
          </p>
          <button
            onClick={() => performJoin(true)}
            disabled={loading}
            className="w-full bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-semibold py-3 rounded-xl mb-3 transition-colors"
            aria-label={`Transfer to ${gymName} and share data`}
          >
            {loading ? t("gymJoin.joining") : t("gymJoin.transferYes", { name: gymName })}
          </button>
          <button
            onClick={() => router.back()}
            className="w-full bg-zinc-700 hover:bg-zinc-600 text-gray-300 py-3 rounded-xl text-sm transition-colors"
          >
            {t("common.cancel")}
          </button>
          {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}
        </div>
      </div>
    );
  }

  // Main consent screen
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full">
        {/* Gym info */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🥋</div>
          <h1 className="text-xl font-bold text-white mb-1">
            <span className="text-[#e94560]">{t("gymJoin.title", { name: gymName })}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {t("gymJoin.managedBy", { owner: ownerName })}
            {maskedEmail && (
              <span className="ml-1 text-gray-600">({maskedEmail})</span>
            )}
          </p>
        </div>

        {/* Consent explanation */}
        <div className="bg-zinc-800 rounded-xl p-4 mb-5 text-sm text-gray-300">
          <p className="font-medium text-white mb-2">{t("gymJoin.ownerCanSee")}</p>
          <ul className="space-y-1 text-xs text-gray-400">
            <li>✅ {t("gymJoin.canSeeFrequency")}</li>
            <li>✅ {t("gymJoin.canSeeBelt")}</li>
            <li>❌ {t("gymJoin.cannotSeeNotes")}</li>
            <li>❌ {t("gymJoin.cannotSeeComp")}</li>
          </ul>
        </div>

        {/* Share data CTA */}
        <button
          onClick={() => handleJoin(true)}
          disabled={loading}
          className="w-full bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white font-semibold py-3 rounded-xl mb-3 transition-colors"
          aria-label="Join gym and share training data"
        >
          {loading ? t("gymJoin.joining") : t("gymJoin.joinAndShare")}
        </button>

        {/* Join without sharing */}
        <button
          onClick={() => handleJoin(false)}
          disabled={loading}
          className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-gray-300 py-3 rounded-xl text-sm mb-4 transition-colors"
          aria-label="Join gym without sharing data"
        >
          {t("gymJoin.joinNoShare")}
        </button>

        {/* Privacy note */}
        <p className="text-[10px] text-gray-600 text-center">
          {t("gymJoin.privacyNote")}
        </p>

        {error && <p className="text-red-400 text-xs mt-3 text-center">{error}</p>}
      </div>
    </div>
  );
}

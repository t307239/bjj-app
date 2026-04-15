"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n";
import type { SupabaseClient } from "@supabase/supabase-js";

interface Props {
  userId: string;
  supabase: SupabaseClient;
}

export default function GymMembershipSection({ userId, supabase }: Props) {
  const { t } = useLocale();
  const [gymName, setGymName] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [gymId, setGymId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("gym_id, share_data_with_gym")
        .eq("id", userId)
        .single();
      if (error) console.error("GymMembershipSection:query", error);
      if (!data?.gym_id) { setLoading(false); return; }
      setGymId(data.gym_id);
      setSharing(data.share_data_with_gym ?? false);
      // Fetch gym name
      const { data: gym, error: gymError } = await supabase
        .from("gyms")
        .select("name")
        .eq("id", data.gym_id)
        .single();
      if (gymError) console.error("GymMembershipSection:query", gymError);
      setGymName(gym?.name ?? null);
      setLoading(false);
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleLeave = async () => {
    setLeaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ gym_id: null, share_data_with_gym: false })
      .eq("id", userId);
    if (!error) {
      setGymId(null);
      setGymName(null);
      setSharing(false);
      setConfirmLeave(false);
    }
    setLeaving(false);
  };

  const handleToggleSharing = async () => {
    setToggleLoading(true);
    const next = !sharing;
    const { error } = await supabase
      .from("profiles")
      .update({ share_data_with_gym: next })
      .eq("id", userId);
    if (!error) {
      setSharing(next);
    }
    setToggleLoading(false);
  };

  if (loading) return null;
  if (!gymId) return null;

  if (confirmLeave) {
    return (
      <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
        <p className="text-sm text-white mb-1">{t("gym.leaveConfirmTitle", { name: gymName ?? t("gym.unknownGym") })}</p>
        <p className="text-xs text-gray-400 mb-4">
          {t("gym.leaveConfirmDesc")}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmLeave(false)}
            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-gray-300 py-2 rounded-lg text-sm"
            aria-label={t("profile.ariaLeaveGymCancel")}
          >
            {t("training.cancel")}
          </button>
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="flex-1 bg-[#e94560] hover:bg-[#c73652] disabled:opacity-50 text-white py-2 rounded-lg text-sm font-semibold"
            aria-label={t("profile.ariaLeaveGymConfirm")}
          >
            {leaving ? t("gym.leaving") : t("gym.leaveGym")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white">{t("gym.currentGym")}</p>
          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5 max-w-[180px]">
            <svg className="w-3 h-3 flex-shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
            <span className="truncate">{gymName ?? t("gym.unknownGym")}</span>
          </p>
        </div>
        <button
          onClick={() => setConfirmLeave(true)}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          aria-label={t("profile.ariaLeaveGym")}
        >
          {t("gym.leaveGym")}
        </button>
      </div>
      {/* Data sharing toggle */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div>
          <p className="text-xs text-gray-300">{t("gym.shareData")}</p>
          <p className="text-xs text-gray-500 mt-0.5">{t("gym.shareDataSub")}</p>
        </div>
        <button
          onClick={handleToggleSharing}
          disabled={toggleLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${sharing ? "bg-[#10B981]" : "bg-zinc-700"}`}
          aria-label={sharing ? t("profile.ariaDisableSharing") : t("profile.ariaEnableSharing")}
          role="switch"
          aria-checked={sharing}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${sharing ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
      {/* Privacy Shield disclosure — B-33: shown when sharing is ON */}
      {sharing && (
        <div className="mt-2 bg-blue-950/20 border border-blue-500/10 rounded-lg p-2.5">
          <p className="text-[10px] font-semibold text-blue-400 mb-1.5">
            🔒 {t("gym.shareDataShieldTitle")}
          </p>
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">{t("gym.shareDataShieldSees")}</p>
              {([1, 2, 3] as const).map((i) => (
                <p key={i} className="text-[10px] text-gray-300 leading-relaxed">✅ {t(`gym.shareDataShieldVisible${i}`)}</p>
              ))}
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 mb-1 uppercase tracking-wide">{t("gym.shareDataShieldHides")}</p>
              {([1, 2, 3] as const).map((i) => (
                <p key={i} className="text-[10px] text-gray-500 leading-relaxed">🔒 {t(`gym.shareDataShieldHidden${i}`)}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

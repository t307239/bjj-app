"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n";

type Props = {
  curriculumUrl: string;
  curriculumSetAt: string;
  gymName: string | null;
  userId: string;
};

/**
 * Shows today's curriculum article dispatched by the gym owner.
 * Only shown when:
 *   - User has gym_id + share_data_with_gym=true
 *   - Gym has a curriculum_url set within the last 7 days
 *
 * Has a "✅ Practiced" button that:
 *   - Marks profiles.curriculum_completed_at = NOW()
 *   - Shows a visual "completed" state (gamification / commitment device)
 */
export default function GymCurriculumCard({ curriculumUrl, curriculumSetAt, gymName, userId }: Props) {
  const { t } = useLocale();
  const [practiced, setPracticed] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    // Check if user has already marked this curriculum dispatch as practiced
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("curriculum_completed_at")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (!data?.curriculum_completed_at) return;
        // If completed_at is AFTER curriculum_set_at, it counts as practiced for this dispatch
        const completedAt = new Date(data.curriculum_completed_at).getTime();
        const setAt = new Date(curriculumSetAt).getTime();
        if (completedAt >= setAt) {
          setPracticed(true);
        }
      });
  }, [userId, curriculumSetAt]);

  const handlePracticed = async (e: React.MouseEvent) => {
    e.preventDefault(); // Don't follow the <a> link
    e.stopPropagation();
    if (marking || practiced) return;
    setMarking(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ curriculum_completed_at: new Date().toISOString() })
      .eq("id", userId);

    if (!error) {
      setPracticed(true);
    }
    setMarking(false);
  };

  // Extract a friendly page title from the URL path
  const pageName = (() => {
    try {
      const url = new URL(curriculumUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      return last
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    } catch {
      return null;
    }
  })();

  const daysAgo = Math.floor(
    (Date.now() - new Date(curriculumSetAt).getTime()) / 86400000
  );

  return (
    <div className={`bg-zinc-900 border rounded-xl px-4 py-3 transition-colors ${practiced ? "border-[#10B981]/40" : "border-white/10"}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">{practiced ? "✅" : "📚"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 tracking-widest mb-0.5">
            {gymName
              ? `From ${gymName}`
              : t("gym.curriculumCardTitle")}
          </p>
          <a
            href={curriculumUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-white truncate hover:underline block"
            aria-label={`Open curriculum article: ${pageName ?? curriculumUrl}`}
          >
            {pageName ?? t("gym.curriculumCardTitle")}
          </a>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {daysAgo === 0 ? t("gym.sentToday") : daysAgo === 1 ? t("gym.sentYesterday") : t("gym.sentDaysAgo", { n: daysAgo })}
          </p>
        </div>

        {/* Read link + Practiced button */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <a
            href={curriculumUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 font-semibold hover:underline"
          >
            {t("gym.curriculumCardCta")}
          </a>
          <button
            type="button"
            onClick={handlePracticed}
            disabled={marking || practiced}
            aria-label={practiced ? t("gym.curriculumPracticedDone") : t("gym.curriculumPracticedBtn")}
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
              practiced
                ? "text-[#10B981] bg-[#10B981]/10 cursor-default"
                : "text-gray-500 hover:text-[#10B981] hover:bg-[#10B981]/10"
            }`}
          >
            {practiced ? t("gym.curriculumPracticedDone") : t("gym.curriculumPracticedBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

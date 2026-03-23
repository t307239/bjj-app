"use client";

import { useLocale } from "@/lib/i18n";

type Props = {
  curriculumUrl: string;
  curriculumSetAt: string;
  gymName: string | null;
};

/**
 * Shows today's curriculum article dispatched by the gym owner.
 * Only shown when:
 *   - User has gym_id + share_data_with_gym=true
 *   - Gym has a curriculum_url set within the last 7 days
 */
export default function GymCurriculumCard({ curriculumUrl, curriculumSetAt, gymName }: Props) {
  const { t } = useLocale();

  // Extract a friendly page title from the URL path
  const pageName = (() => {
    try {
      const url = new URL(curriculumUrl);
      const parts = url.pathname.split("/").filter(Boolean);
      const last = parts[parts.length - 1] ?? "";
      // Convert kebab-case to Title Case
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
    <a
      href={curriculumUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 hover:border-white/25 transition-colors group"
      aria-label={`Open curriculum article: ${pageName ?? curriculumUrl}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0 mt-0.5">📚</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 tracking-widest mb-0.5">
            {gymName
              ? `From ${gymName}`
              : t("gym.curriculumCardTitle")}
          </p>
          <p className="text-sm font-semibold text-white truncate">
            {pageName ?? t("gym.curriculumCardTitle")}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {daysAgo === 0 ? "Sent today" : daysAgo === 1 ? "Sent yesterday" : `Sent ${daysAgo} days ago`}
          </p>
        </div>
        <span className="text-xs text-blue-500 font-semibold flex-shrink-0 mt-0.5 group-hover:underline">
          {t("gym.curriculumCardCta")}
        </span>
      </div>
    </a>
  );
}

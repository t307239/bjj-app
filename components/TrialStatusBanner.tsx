"use client";

/**
 * TrialStatusBanner — z255ooo: shows remaining days of complimentary 14-day Pro trial.
 *   (z255uuu: bumped from 7 → 14 days to match LP copy + Stripe industry default)
 *
 * Renders only if:
 *   - User is NOT already a paying Pro (is_pro=false)
 *   - complimentary_trial_until is set AND in the future
 *
 * On expiry: returns null silently. User can upgrade via /pricing if they want
 * to keep Pro features. No CC was required for the trial; no surprise charges.
 */

import Link from "next/link";
import { useLocale } from "@/lib/i18n";
import { getTrialStatus, type ProEligibleProfile } from "@/lib/proAccess";

type Props = {
  profile: ProEligibleProfile | null | undefined;
  isPro: boolean;
};

export default function TrialStatusBanner({ profile, isPro }: Props) {
  const { t } = useLocale();
  if (isPro) return null;
  const status = getTrialStatus(profile);
  if (!status) return null;

  const { daysLeft } = status;

  return (
    <section
      className="mb-4 rounded-xl px-4 py-3 flex items-center gap-3"
      style={{
        background: "linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
      }}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" className="text-2xl flex-shrink-0">🎁</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-amber-200 truncate">
          {daysLeft === 1
            ? t("trial.lastDay")
            : t("trial.daysLeft", { n: daysLeft })}
        </p>
        <p className="text-xs text-amber-100/80 truncate">
          {t("trial.subtitle")}
        </p>
      </div>
      <Link
        href="/pricing"
        className="flex-shrink-0 inline-flex items-center gap-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-900 font-bold py-1.5 px-3 rounded-md text-xs whitespace-nowrap transition-all"
      >
        {t("trial.upgradeCta")}
      </Link>
    </section>
  );
}

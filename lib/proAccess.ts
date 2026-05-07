/**
 * proAccess.ts — z255ooo: Centralized Pro access check
 *
 * Combines two grants:
 *   1. is_pro: true       — Stripe subscription active (or admin-granted)
 *   2. complimentary_trial_until > NOW() — No-CC 7-day trial (auto-set on first log)
 *
 * Both signals grant identical Pro feature access. Trial expiry is silent
 * (UI shows banner during, normal Free state after; user can upgrade via /pricing).
 *
 * Why centralized: ProGate / ProStatusBanner / Pro-feature components must
 * agree on the access logic. Any divergence = bug. Use hasProAccess(profile)
 * everywhere instead of profile.is_pro.
 */

export type ProEligibleProfile = {
  is_pro?: boolean | null;
  complimentary_trial_until?: string | null;
};

/**
 * Returns true if the user currently has Pro feature access (paid or trial).
 * @param profile — partial profile with is_pro and complimentary_trial_until
 * @param now — override for testing; defaults to current time
 */
export function hasProAccess(
  profile: ProEligibleProfile | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!profile) return false;
  if (profile.is_pro === true) return true;
  if (profile.complimentary_trial_until) {
    const trialEnd = new Date(profile.complimentary_trial_until);
    if (!isNaN(trialEnd.getTime()) && trialEnd > now) return true;
  }
  return false;
}

/**
 * Returns trial state info. `daysLeft` is rounded UP (so 5h = "1 day left").
 * Returns null if user has no active trial (either expired or not yet started).
 */
export function getTrialStatus(
  profile: ProEligibleProfile | null | undefined,
  now: Date = new Date(),
): { daysLeft: number; endDate: Date } | null {
  if (!profile?.complimentary_trial_until) return null;
  const trialEnd = new Date(profile.complimentary_trial_until);
  if (isNaN(trialEnd.getTime())) return null;
  const msLeft = trialEnd.getTime() - now.getTime();
  if (msLeft <= 0) return null;
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
  return { daysLeft, endDate: trialEnd };
}

/**
 * Server-side helper for granting trial. Returns ISO string of trial end (NOW + 14d default).
 * z255uuu: bumped from 7 → 14 to match LP copy + Stripe industry standard + AI weekly cycle x2.
 * Call from useTrainingLog after first session save (only if trial not yet granted).
 */
export function calculateTrialEnd(
  durationDays: number = 14,
  now: Date = new Date(),
): string {
  const end = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return end.toISOString();
}

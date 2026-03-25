"use client";

/**
 * SkillMap — Entry point.
 * Delegates to SkillMapV2 (React Flow based, unified PC + Mobile).
 * Legacy SkillMapPC and SkillMapMobile are preserved but no longer used.
 */

import SkillMapV2 from "./SkillMapV2";

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

export default function SkillMap(props: Props) {
  return <SkillMapV2 {...props} />;
}

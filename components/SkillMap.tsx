"use client";

/**
 * SkillMap — Device-aware wrapper.
 * Detects touch device via `(pointer: coarse)` media query and renders
 * either the mobile drilldown or the PC canvas.
 */

import React, { useState, useEffect } from "react";
import SkillMapMobile from "./SkillMapMobile";
import SkillMapPC from "./SkillMapPC";

type Props = {
  userId: string;
  isPro: boolean;
  stripePaymentLink: string | null;
  stripeAnnualLink: string | null;
};

export default function SkillMap({ userId, isPro, stripePaymentLink, stripeAnnualLink }: Props) {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouchDevice(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // While detecting — render nothing to avoid SSR/hydration mismatch
  if (isTouchDevice === null) return null;

  if (isTouchDevice) {
    return (
      <SkillMapMobile
        userId={userId}
        isPro={isPro}
        stripePaymentLink={stripePaymentLink}
        stripeAnnualLink={stripeAnnualLink}
      />
    );
  }

  return (
    <SkillMapPC
      userId={userId}
      isPro={isPro}
      stripePaymentLink={stripePaymentLink}
      stripeAnnualLink={stripeAnnualLink}
    />
  );
}

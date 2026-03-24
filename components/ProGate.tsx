"use client";

import { useLocale } from "@/lib/i18n";

const STRIPE_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ?? "#";

interface ProGateProps {
  isPro: boolean;
  children: React.ReactNode;
  feature?: string;
  userId?: string;
}

/**
 * ProGate — wraps any feature with a paywall blur overlay.
 * If the user is Pro, renders children directly.
 * If not, renders a blurred preview with an upgrade CTA.
 */
export default function ProGate({
  isPro,
  children,
  feature,
  userId,
}: ProGateProps) {
  const { t } = useLocale();
  const featureText = feature || t("pro.defaultFeature");
  if (isPro) {
    return <>{children}</>;
  }

  // Build payment link with userId metadata so webhook can identify the user
  const paymentUrl = userId
    ? `${STRIPE_PAYMENT_LINK}?client_reference_id=${userId}`
    : STRIPE_PAYMENT_LINK;

  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-60">
        {children}
      </div>

      {/* Upgrade overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-zinc-950/80 backdrop-blur-sm border border-white/10 z-10">
        <div className="text-center px-4">
          <div className="text-2xl mb-2">🔒</div>
          <p className="text-sm text-gray-400 mb-1">{featureText}</p>
          <p className="text-xs text-gray-500 mb-4">{t("pro.available")}</p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold px-5 py-2 rounded-lg transition-colors"
            onClick={() => {
              if (typeof gtag !== "undefined") {
                gtag("event", "upgrade_click", { feature: featureText });
              }
            }}
          >
            {t("pro.upgradeButton")}
          </a>
          <p className="text-xs text-gray-500 mt-2">
            {t("pro.features")}
          </p>
        </div>
      </div>
    </div>
  );
}

// Type declaration for gtag (defined in layout.tsx inline script)
declare function gtag(
  command: string,
  action: string,
  params?: Record<string, string>
): void;

"use client";

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
  feature = "この機能",
  userId,
}: ProGateProps) {
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
          <p className="text-sm text-[#6b7699] mb-1">{feature}</p>
          <p className="text-xs text-[#4a5270] mb-4">Pro プランで利用可能</p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[#e94560] hover:bg-[#c73a53] text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors"
            onClick={() => {
              if (typeof gtag !== "undefined") {
                gtag("event", "upgrade_click", { feature });
              }
            }}
          >
            Pro にアップグレード — $4.99/月
          </a>
          <p className="text-[10px] text-[#4a5270] mt-2">
            CSV・PDF・12ヶ月グラフ・StreakFreeze拡張
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

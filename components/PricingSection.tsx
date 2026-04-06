"use client";

import { useState } from "react";
import Link from "next/link";

const STRIPE_MONTHLY_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || null;
const STRIPE_ANNUAL_LINK = process.env.NEXT_PUBLIC_STRIPE_ANNUAL_LINK || null;

export default function PricingSection({ userId }: { userId?: string | null }) {
  const [isAnnual, setIsAnnual] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);

  // userId がない（未ログイン）場合は /login に誘導する。
  // Stripe に直接飛ばすと client_reference_id が渡らず is_pro が立たない。
  const monthlyUrl = userId && STRIPE_MONTHLY_LINK
    ? `${STRIPE_MONTHLY_LINK}?client_reference_id=${userId}`
    : "/login";

  const annualUrl = userId && STRIPE_ANNUAL_LINK
    ? `${STRIPE_ANNUAL_LINK}?client_reference_id=${userId}`
    : "/login";

  const upgradeUrl = isAnnual ? annualUrl : monthlyUrl;

  return (
    <section id="pricing" className="px-4 py-16 bg-zinc-900/50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-3 text-white">Simple Pricing</h2>
        <p className="text-gray-500 text-center text-sm mb-8">All core features are free forever.</p>

        {/* Monthly / Annual toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium ${!isAnnual ? "text-white" : "text-gray-500"}`}>Monthly</span>
          <button
            onClick={() => setIsAnnual((v) => !v)}
            aria-label="Toggle billing period"
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${
              isAnnual ? "bg-emerald-600" : "bg-zinc-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isAnnual ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${isAnnual ? "text-white" : "text-gray-500"}`}>
            Annually
          </span>
          {isAnnual && (
            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              Save 16%
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10">
            <div className="text-lg font-bold mb-1">Free</div>
            <div className="text-3xl font-bold text-white mb-1">$0</div>
            <div className="text-gray-500 text-xs mb-6">Free forever</div>
            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Training log (unlimited)</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Technique journal</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Goal tracker</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> 30-day history &amp; graphs</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Day streak tracking</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Competition records</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> CSV export</li>
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Basic Skill Map (up to 10 nodes)</li>
            </ul>
            <Link
              href="/login"
              className="mt-8 block text-center bg-[#10B981] hover:bg-[#0d9668] text-white font-bold py-3 rounded-full transition-all"
            >
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-zinc-900 rounded-2xl p-8 border border-yellow-500/50 relative">
            <div className="absolute -top-3 right-6 bg-yellow-500 text-black text-xs px-3 py-1 rounded-full font-bold">
              Most Popular
            </div>
            <div className="text-lg font-bold mb-1">Pro</div>

            {/* Price display toggles */}
            {isAnnual ? (
              <>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-white">$79.99</div>
                  <span className="text-sm font-normal text-gray-500">/ year</span>
                  <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    Save 33%
                  </span>
                </div>
                <div className="text-gray-500 text-xs mb-6">≈ $6.67/mo · Billed annually</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-white mb-1">
                  $9.99<span className="text-sm font-normal text-gray-500">/mo (tax incl.)</span>
                </div>
                <div className="text-gray-500 text-xs mb-6">Billed monthly</div>
              </>
            )}

            <ul className="space-y-3 text-sm text-gray-400">
              <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Everything in Free</li>
              <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> Unlimited Skill Map</li>
              <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> 12-month graphs</li>
              <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> Streak freeze</li>
              <li className="flex items-center gap-2"><span className="text-yellow-400">★</span> Priority support</li>
            </ul>

            {/* Stripe pre-checkout disclaimer */}
            <label className="flex items-start gap-2 mt-6 cursor-pointer text-left">
              <input
                type="checkbox"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/20 bg-zinc-800 accent-yellow-500 flex-shrink-0 cursor-pointer"
                aria-label="Subscription disclaimer acknowledgement"
              />
              <span className="text-xs text-gray-400 leading-relaxed">
                I understand this is a digital subscription service. I agree to the{" "}
                <Link href="/terms" className="text-emerald-400 hover:underline">Terms of Service</Link>.
              </span>
            </label>

            <a
              href={disclaimerAccepted ? upgradeUrl : undefined}
              className={`mt-3 block text-center font-bold py-3 rounded-full transition-all ${
                disclaimerAccepted
                  ? "bg-yellow-500 hover:bg-yellow-400 text-black cursor-pointer"
                  : "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              }`}
              onClick={(e) => {
                if (!disclaimerAccepted) e.preventDefault();
              }}
              aria-disabled={!disclaimerAccepted}
            >
              Upgrade to Pro
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | BJJ App",
  description: "Privacy Policy for BJJ App — how we collect, use, and protect your data.",
  robots: { index: false },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-[#e2e8f0] px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-gray-400 hover:text-white mb-8 inline-block">
          ← Back to BJJ App
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: March 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Information We Collect</h2>
            <p className="mb-3">We collect the following information when you use BJJ App:</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-400">
              <li>
                <span className="text-zinc-100 font-medium">Account information</span> — email address
                and display name provided by your OAuth provider (Google / GitHub) or directly by you
              </li>
              <li>
                <span className="text-zinc-100 font-medium">Training data</span> — session logs,
                technique records, streak data, goals, and notes you enter in the app
              </li>
              <li>
                <span className="text-zinc-100 font-medium">Profile data</span> — belt rank, gym name,
                BJJ start date, and any other profile fields you choose to fill in
              </li>
              <li>
                <span className="text-zinc-100 font-medium">Usage data</span> — basic analytics via
                Google Analytics 4 (anonymized, no personally identifiable information)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-2 text-gray-400">
              <li>To provide and improve the Service</li>
              <li>To display your training data back to you in the dashboard</li>
              <li>To process subscription payments (via Stripe)</li>
              <li>To send product updates if you opt in to our newsletter (via Beehiiv)</li>
              <li>To analyze aggregate usage patterns and improve features</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Data Storage</h2>
            <p>
              Your data is stored in Supabase (PostgreSQL), hosted on AWS. Data is encrypted at rest
              and in transit. Row-Level Security (RLS) ensures that each user can only access their
              own data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p className="mb-2">We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-400">
              <li><span className="text-zinc-100">Supabase</span> — database and authentication</li>
              <li><span className="text-zinc-100">Vercel</span> — hosting and deployment</li>
              <li><span className="text-zinc-100">Stripe</span> — payment processing (Pro subscriptions)</li>
              <li><span className="text-zinc-100">Google Analytics 4</span> — anonymized usage analytics</li>
              <li><span className="text-zinc-100">Beehiiv</span> — email newsletter (opt-in only)</li>
            </ul>
            <p className="mt-3 text-gray-500">
              Each of these services has its own privacy policy. We only share the minimum data
              necessary with each provider.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Cookies</h2>
            <p>
              We use only essential cookies required for authentication (Supabase session cookies).
              We do not use advertising cookies or tracking pixels beyond Google Analytics, which
              is configured in anonymized mode.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Sharing</h2>
            <p>
              We do not sell your personal data. We do not share your individual training data
              with third parties, except as required by law or to provide the Service through the
              processors listed above.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 text-gray-400">
              <li>Access all data we hold about you (available via the dashboard export feature)</li>
              <li>Correct inaccurate data (editable in your profile)</li>
              <li>Delete your account and all associated data (Profile → Settings → Delete Account)</li>
              <li>Withdraw newsletter consent at any time via the unsubscribe link in any email</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. Upon account deletion,
              your data is permanently removed from our primary database within 30 days. Backups
              may retain data for an additional 30 days before being purged.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
            <p>
              BJJ App is not directed at children under 13. We do not knowingly collect personal
              information from children under 13. If you believe a child has provided us personal
              information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes via an in-app notice. Continued use of the Service constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p>
              For privacy-related inquiries or data deletion requests, please contact us at
              307239t777@gmail.com.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-6 text-xs text-gray-600">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/legal/tokushoho" className="hover:text-gray-400 transition-colors">Specified Commercial Transactions Act</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">← Home</Link>
        </div>
      </div>
    </main>
  );
}

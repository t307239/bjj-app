import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for BJJ App — how we collect, use, and protect your data.",
  robots: { index: false },
};

const TOC = [
  { id: "collect", label: "1. Information We Collect" },
  { id: "use", label: "2. How We Use Your Information" },
  { id: "storage", label: "3. Data Storage" },
  { id: "third-party", label: "4. Third-Party Services" },
  { id: "cookies", label: "5. Cookies" },
  { id: "sharing", label: "6. Data Sharing" },
  { id: "rights", label: "7. Your Rights" },
  { id: "retention", label: "8. Data Retention" },
  { id: "children", label: "9. Children's Privacy" },
  { id: "changes", label: "10. Changes to This Policy" },
  { id: "contact", label: "11. Contact" },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white mb-8 inline-flex items-center gap-1 transition-colors">
          ← Back to BJJ App
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2 mt-4">Privacy Policy</h1>
        <p className="text-zinc-400 text-sm mb-8">Last updated: March 2026</p>

        {/* Table of Contents */}
        <nav className="bg-zinc-900/60 border border-white/8 rounded-xl px-5 py-4 mb-10">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Contents</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {TOC.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10 text-sm leading-relaxed">
          <section id="collect">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              1. Information We Collect
            </h2>
            <p className="text-zinc-400 mb-3">We collect the following information when you use BJJ App:</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li>
                <span className="text-zinc-200 font-medium">Account information</span> — email address
                and display name provided by your OAuth provider (Google / GitHub) or directly by you
              </li>
              <li>
                <span className="text-zinc-200 font-medium">Training data</span> — session logs,
                technique records, streak data, goals, and notes you enter in the app
              </li>
              <li>
                <span className="text-zinc-200 font-medium">Profile data</span> — belt rank, gym name,
                BJJ start date, and any other profile fields you choose to fill in
              </li>
              <li>
                <span className="text-zinc-200 font-medium">Usage data</span> — basic analytics via
                Google Analytics 4 (anonymized, no personally identifiable information)
              </li>
            </ul>
          </section>

          <section id="use">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>To provide and improve the Service</li>
              <li>To display your training data back to you in the dashboard</li>
              <li>To process subscription payments (via Stripe)</li>
              <li>To send product updates if you opt in to our newsletter (via Beehiiv)</li>
              <li>To analyze aggregate usage patterns and improve features</li>
            </ul>
          </section>

          <section id="storage">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              3. Data Storage
            </h2>
            <p className="text-zinc-400">
              Your data is stored in Supabase (PostgreSQL), hosted on AWS. Data is encrypted at rest
              and in transit. Row-Level Security (RLS) ensures that each user can only access their
              own data.
            </p>
          </section>

          <section id="third-party">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              4. Third-Party Services
            </h2>
            <p className="text-zinc-400 mb-3">We use the following third-party services:</p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400">
              <li><span className="text-zinc-200">Supabase</span> — database and authentication</li>
              <li><span className="text-zinc-200">Vercel</span> — hosting and deployment</li>
              <li><span className="text-zinc-200">Stripe</span> — payment processing (Pro subscriptions)</li>
              <li><span className="text-zinc-200">Google Analytics 4</span> — anonymized usage analytics</li>
              <li><span className="text-zinc-200">Beehiiv</span> — email newsletter (opt-in only)</li>
            </ul>
            <p className="mt-3 text-zinc-400">
              Each of these services has its own privacy policy. We only share the minimum data
              necessary with each provider.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              5. Cookies
            </h2>
            <p className="text-zinc-400">
              We use only essential cookies required for authentication (Supabase session cookies).
              We do not use advertising cookies or tracking pixels beyond Google Analytics, which
              is configured in anonymized mode.
            </p>
          </section>

          <section id="sharing">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              6. Data Sharing
            </h2>
            <p className="text-zinc-400">
              We do not sell your personal data. We do not share your individual training data
              with third parties, except as required by law or to provide the Service through the
              processors listed above.
            </p>
          </section>

          <section id="rights">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              7. Your Rights
            </h2>
            <p className="text-zinc-400 mb-2">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Access all data we hold about you (available via the dashboard export feature)</li>
              <li>Correct inaccurate data (editable in your profile)</li>
              <li>Delete your account and all associated data (Profile → Settings → Delete Account)</li>
              <li>Withdraw newsletter consent at any time via the unsubscribe link in any email</li>
            </ul>
          </section>

          <section id="retention">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              8. Data Retention
            </h2>
            <p className="text-zinc-400">
              We retain your data for as long as your account is active. Upon account deletion,
              your data is permanently removed from our primary database within 30 days. Backups
              may retain data for an additional 30 days before being purged.
            </p>
          </section>

          <section id="children">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              9. Children&apos;s Privacy
            </h2>
            <p className="text-zinc-400">
              BJJ App is not directed at children under 13. We do not knowingly collect personal
              information from children under 13. If you believe a child has provided us personal
              information, please contact us.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              10. Changes to This Policy
            </h2>
            <p className="text-zinc-400">
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes via an in-app notice. Continued use of the Service constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              11. Contact
            </h2>
            <p className="text-zinc-400">
              For privacy-related inquiries or data deletion requests, please contact us at{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-6 text-xs text-zinc-400">
          <Link href="/terms" className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <Link href="/legal/tokushoho" className="hover:text-zinc-400 transition-colors">Specified Commercial Transactions Act</Link>
          <Link href="/" className="hover:text-zinc-400 transition-colors">← Home</Link>
        </div>
      </div>
    </main>
  );
}

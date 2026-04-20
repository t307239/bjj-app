import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for BJJ App — how we collect, use, and protect your data.",
  robots: { index: false },
  alternates: {
    canonical: "https://bjj-app.net/privacy",
  },
};

const TOC = [
  { id: "collect", label: "1. Information We Collect" },
  { id: "use", label: "2. How We Use Your Information" },
  { id: "storage", label: "3. Data Storage" },
  { id: "third-party", label: "4. Third-Party Services" },
  { id: "cookies", label: "5. Cookies & Tracking" },
  { id: "sharing", label: "6. Data Sharing" },
  { id: "rights", label: "7. Your Rights" },
  { id: "portability", label: "8. Data Portability" },
  { id: "retention", label: "9. Data Retention" },
  { id: "children", label: "10. Children's Privacy" },
  { id: "security-incident", label: "11. Security Incident Notification" },
  { id: "ccpa", label: "12. California Privacy Rights (CCPA)" },
  { id: "changes", label: "13. Changes to This Policy" },
  { id: "contact", label: "14. Contact" },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-zinc-300 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white mb-8 inline-flex items-center gap-1 transition-colors">
          ← Back to BJJ App
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2 mt-4">Privacy Policy</h1>
        <p className="text-zinc-400 text-sm mb-8">Last updated: April 2026</p>

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
                <span className="text-zinc-200 font-medium">Usage data</span> — anonymous page-level
                analytics via Vercel Analytics (no personally identifiable information)
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
              <li>To send product updates if you opt in to email notifications</li>
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
              <li><span className="text-zinc-200">Vercel Analytics</span> — anonymized page-level analytics</li>
            </ul>
            <p className="mt-3 text-zinc-400">
              Each of these services has its own privacy policy. We only share the minimum data
              necessary with each provider.
            </p>
          </section>

          <section id="cookies">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              5. Cookies &amp; Tracking
            </h2>
            <p className="text-zinc-400 mb-3">
              BJJ App uses a minimal set of cookies, organized into three categories:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-zinc-400 mb-3">
              <li>
                <span className="text-zinc-200 font-medium">Essential</span> — authentication
                session cookies (Supabase). These cannot be disabled and are required for the
                Service to function.
              </li>
              <li>
                <span className="text-zinc-200 font-medium">Analytics</span> — anonymized
                page-level usage data via Vercel Analytics. No personally identifiable
                information is collected. You may opt out via the cookie preferences banner.
              </li>
              <li>
                <span className="text-zinc-200 font-medium">Marketing</span> — currently not
                used. If we introduce marketing cookies in the future, they will require your
                explicit opt-in consent.
              </li>
            </ul>
            <p className="text-zinc-400">
              You can manage your cookie preferences at any time by clearing your browser
              cookies for bjj-app.net, which will re-display the consent banner on your next
              visit. We do not use advertising cookies, tracking pixels, or fingerprinting
              techniques.
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
              <li>Export your data in machine-readable format at any time (see Data Portability below)</li>
            </ul>
          </section>

          <section id="portability">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              8. Data Portability
            </h2>
            <p className="text-zinc-400 mb-2">
              You own your training data. BJJ App supports free data export for all users —
              regardless of subscription tier — in the following machine-readable formats:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 mb-3">
              <li><span className="text-zinc-200">CSV</span> — training logs, technique records, streak history (compatible with Excel, Google Sheets, Numbers)</li>
              <li><span className="text-zinc-200">PDF</span> — a printable summary report with statistics and charts</li>
            </ul>
            <p className="text-zinc-400">
              Export is available from the dashboard at any time. Even if you cancel a Pro subscription
              or delete your account, you can download your full data set beforehand. This satisfies
              the data portability requirement under GDPR Article 20 and similar regulations.
            </p>
          </section>

          <section id="retention">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              9. Data Retention
            </h2>
            <p className="text-zinc-400 mb-3">
              We retain your data for as long as your account is active. Specific retention
              periods by data category:
            </p>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="py-2 pr-4 text-zinc-300 font-semibold">Data Category</th>
                    <th className="py-2 pr-4 text-zinc-300 font-semibold">While Active</th>
                    <th className="py-2 text-zinc-300 font-semibold">After Deletion</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-400">
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Training logs &amp; techniques</td>
                    <td className="py-2 pr-4">Retained indefinitely</td>
                    <td className="py-2">Purged within 30 days</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Profile &amp; account data</td>
                    <td className="py-2 pr-4">Retained indefinitely</td>
                    <td className="py-2">Purged within 30 days</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Payment records (Stripe)</td>
                    <td className="py-2 pr-4">Retained per Stripe policy</td>
                    <td className="py-2">Retained for tax/legal compliance (up to 7 years)</td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="py-2 pr-4">Push notification tokens</td>
                    <td className="py-2 pr-4">Until unsubscribed or expired</td>
                    <td className="py-2">Deleted immediately on account deletion</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Analytics (Vercel)</td>
                    <td className="py-2 pr-4">Anonymized, no PII</td>
                    <td className="py-2">Not linked to individual accounts</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-zinc-400">
              Upon account deletion, your data enters a 30-day soft-delete period during
              which you may request restoration. After this window, data is permanently
              removed from our primary database. Encrypted backups may retain data for an
              additional 30 days before automatic purge.
            </p>
          </section>

          <section id="children">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              10. Children&apos;s Privacy
            </h2>
            <p className="text-zinc-400 mb-3">
              BJJ App is not directed at children under 13 (United States, per COPPA) or
              under 16 (European Economic Area, per GDPR). We do not knowingly collect
              personal information from individuals below these age thresholds.
            </p>
            <p className="text-zinc-400 mb-3">
              If you are a parent or guardian and believe your child has provided personal
              information to BJJ App without your consent, please contact us at{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              . We will promptly verify the request and delete any data associated with the
              child&apos;s account within 48 hours.
            </p>
            <p className="text-zinc-400">
              Minors between 13 and 16 (or the applicable age of digital consent in their
              jurisdiction) may use BJJ App only with verifiable parental or guardian consent.
            </p>
          </section>

          <section id="security-incident">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              11. Security Incident Notification
            </h2>
            <p className="text-zinc-400 mb-3">
              In the event of a data breach that affects your personal information, we will:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 mb-3">
              <li>Notify affected users via email within 72 hours of confirmed discovery, as required by GDPR Article 33</li>
              <li>Describe the nature of the breach, the categories of data affected, and the approximate number of individuals impacted</li>
              <li>Outline the measures taken to contain and remediate the breach</li>
              <li>Provide guidance on steps you can take to protect yourself</li>
            </ul>
            <p className="text-zinc-400">
              We also maintain appropriate technical and organizational security measures —
              including encryption at rest and in transit, Row-Level Security, and regular
              access reviews — to minimize the risk and impact of security incidents.
            </p>
          </section>

          <section id="ccpa">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              12. California Privacy Rights (CCPA)
            </h2>
            <p className="text-zinc-400 mb-3">
              If you are a California resident, the California Consumer Privacy Act (CCPA)
              grants you additional rights regarding your personal information:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 mb-3">
              <li><span className="text-zinc-200 font-medium">Right to Know</span> — you may request the categories and specific pieces of personal information we have collected about you</li>
              <li><span className="text-zinc-200 font-medium">Right to Delete</span> — you may request deletion of your personal information (available via Profile → Settings → Delete Account)</li>
              <li><span className="text-zinc-200 font-medium">Right to Opt-Out of Sale</span> — BJJ App does not sell, rent, or trade your personal information to third parties for monetary or other valuable consideration. Therefore, there is no need to opt out</li>
              <li><span className="text-zinc-200 font-medium">Right to Non-Discrimination</span> — we will not discriminate against you for exercising any of your CCPA rights</li>
            </ul>
            <p className="text-zinc-400">
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>
              . We will verify your identity and respond within 45 days as required by the CCPA.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              13. Changes to This Policy
            </h2>
            <p className="text-zinc-400">
              We may update this Privacy Policy from time to time. We will notify users of
              significant changes via an in-app notice. Continued use of the Service constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              14. Contact
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
          <Link href="/legal/dpa" className="hover:text-zinc-400 transition-colors">Data Processing Agreement</Link>
          <Link href="/legal/tokushoho" className="hover:text-zinc-400 transition-colors">Specified Commercial Transactions Act</Link>
          <Link href="/" className="hover:text-zinc-400 transition-colors">← Home</Link>
        </div>
      </div>
    </main>
  );
}

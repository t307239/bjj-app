import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for BJJ App — Brazilian Jiu-Jitsu training tracker.",
  robots: { index: false },
};

const TOC = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "description", label: "2. Description of Service" },
  { id: "accounts", label: "3. User Accounts" },
  { id: "content", label: "4. User Content" },
  { id: "subscription", label: "5. Paid Subscription (Pro)" },
  { id: "conduct", label: "6. Prohibited Conduct" },
  { id: "disclaimers", label: "7. Disclaimers" },
  { id: "liability", label: "8. Limitation of Liability" },
  { id: "deletion", label: "9. Account Deletion" },
  { id: "changes", label: "10. Changes to Terms" },
  { id: "contact", label: "11. Contact" },
  { id: "governing", label: "12. Governing Law" },
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-300 px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white mb-8 inline-flex items-center gap-1 transition-colors">
          ← Back to BJJ App
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2 mt-4">Terms of Service</h1>
        <p className="text-zinc-500 text-sm mb-8">Last updated: March 2026</p>

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
          <section id="acceptance">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              1. Acceptance of Terms
            </h2>
            <p className="text-zinc-400">
              By accessing or using BJJ App (&quot;the Service&quot;), you agree to be bound by these Terms
              of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section id="description">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              2. Description of Service
            </h2>
            <p className="text-zinc-400">
              BJJ App is a Brazilian Jiu-Jitsu training tracker that allows users to log training
              sessions, track techniques, monitor streaks, and visualize their progress. A free tier
              and a paid Pro tier are available.
            </p>
          </section>

          <section id="accounts">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              3. User Accounts
            </h2>
            <p className="text-zinc-400 mb-3">
              You may sign in using a third-party provider (Google, GitHub) or a magic-link email.
              You are responsible for maintaining the confidentiality of your account and for all
              activities that occur under your account.
            </p>
            <p className="text-zinc-400">
              You must be at least 13 years old to use this Service. By using BJJ App you represent
              that you meet this requirement. If you are between 13 and 17 years old, you must have
              the consent of a parent or legal guardian to use this Service. Your parent or guardian
              agrees to be bound by these Terms on your behalf.
            </p>
          </section>

          <section id="content">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              4. User Content
            </h2>
            <p className="text-zinc-400">
              You retain ownership of any training data, notes, and content you submit. By submitting
              content you grant BJJ App a limited license to store and display it solely to provide
              the Service. We will not sell your personal training data to third parties.
            </p>
          </section>

          <section id="subscription">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              5. Paid Subscription (Pro)
            </h2>
            <p className="text-zinc-400 mb-3">
              Pro features are available for a monthly subscription fee (USD $9.99/month or $79.99/year, tax inclusive).
              Payments are processed securely through Stripe (Visa, Mastercard, American Express, JCB).
            </p>
            <p className="text-zinc-400 mb-3">
              Subscriptions renew automatically on the same date each month. To cancel, go to your
              account settings at least 24 hours before the next billing date. Cancellation takes
              effect at the end of the current billing period. No partial-month refunds are provided.
            </p>
            <p className="text-zinc-400 mb-3">
              Refund requests are accepted within 7 days of the initial charge only. To request a
              refund, email{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>{" "}
              with your account email address. No refund is available for subsequent monthly renewals.
            </p>
            <p className="text-zinc-400">
              We reserve the right to change pricing with 30 days&apos; advance notice. Price changes
              do not apply to the current billing period.
            </p>
          </section>

          <section id="conduct">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              6. Prohibited Conduct
            </h2>
            <p className="text-zinc-400 mb-2">You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Reverse-engineer or scrape the Service at scale</li>
              <li>Upload malicious code or interfere with the Service&apos;s integrity</li>
            </ul>
          </section>

          <section id="disclaimers">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              7. Disclaimers
            </h2>
            <p className="text-zinc-400">
              The Service is provided &quot;as is&quot; without warranties of any kind. BJJ App is a
              training log and informational tool — it is not a substitute for qualified instruction.
              Brazilian Jiu-Jitsu is a contact sport that carries inherent risks of physical injury.
              BJJ App is not responsible for any injury, harm, or loss resulting from training
              activities, whether or not such activities were logged or referenced in the Service.
              Certain techniques (including but not limited to heel hooks, kneebars, and neck cranks)
              carry a particularly high risk of serious injury. Always train under qualified
              supervision and consult a medical professional before beginning any physical training program.
            </p>
          </section>

          <section id="liability">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              8. Limitation of Liability
            </h2>
            <p className="text-zinc-400">
              To the maximum extent permitted by law, BJJ App shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section id="deletion">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              9. Account Deletion
            </h2>
            <p className="text-zinc-400">
              You may delete your account at any time from the Profile page. Upon deletion, your
              training data will be permanently removed from our servers within 30 days.
            </p>
          </section>

          <section id="changes">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              10. Changes to Terms
            </h2>
            <p className="text-zinc-400">
              We may update these terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the new terms. Significant changes will be announced
              in the app.
            </p>
          </section>

          <section id="contact">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              11. Contact
            </h2>
            <p className="text-zinc-400">
              For any questions about these Terms, please contact us at{" "}
              <a href="mailto:307239t777@gmail.com" className="text-emerald-400 hover:underline">
                307239t777@gmail.com
              </a>.
            </p>
          </section>

          <section id="governing">
            <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-emerald-500/40">
              12. Governing Law
            </h2>
            <p className="text-zinc-400">
              These Terms are governed by the laws of Japan. Any disputes arising from or in
              connection with these Terms shall be subject to the exclusive jurisdiction of the
              Tokyo District Court.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-wrap gap-6 text-xs text-zinc-400">
          <Link href="/privacy" className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link href="/legal/tokushoho" className="hover:text-zinc-400 transition-colors">Specified Commercial Transactions Act</Link>
          <Link href="/" className="hover:text-zinc-400 transition-colors">← Home</Link>
        </div>
      </div>
    </main>
  );
}

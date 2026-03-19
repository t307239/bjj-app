import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | BJJ App",
  description: "Terms of Service for BJJ App — Brazilian Jiu-Jitsu training tracker.",
  robots: { index: false },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0f172a] text-gray-300 px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-[#e94560] hover:underline mb-8 inline-block">
          ← Back to BJJ App
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-10">Last updated: March 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using BJJ App (&quot;the Service&quot;), you agree to be bound by these Terms
              of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              BJJ App is a Brazilian Jiu-Jitsu training tracker that allows users to log training
              sessions, track techniques, monitor streaks, and visualize their progress. A free tier
              and a paid Pro tier are available.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. User Accounts</h2>
            <p className="mb-2">
              You may sign in using a third-party provider (Google, GitHub) or a magic-link email.
              You are responsible for maintaining the confidentiality of your account and for all
              activities that occur under your account.
            </p>
            <p>
              You must be at least 13 years old to use this Service. By using BJJ App you represent
              that you meet this requirement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. User Content</h2>
            <p>
              You retain ownership of any training data, notes, and content you submit. By submitting
              content you grant BJJ App a limited license to store and display it solely to provide
              the Service. We will not sell your personal training data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Paid Subscription (Pro)</h2>
            <p className="mb-2">
              Pro features are available for a monthly subscription fee. Payments are processed
              securely through Stripe. Subscriptions renew automatically unless cancelled.
            </p>
            <p>
              Refunds may be requested within 7 days of a charge by contacting us. We reserve the
              right to change pricing with 30 days&apos; notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-gray-400">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Reverse-engineer or scrape the Service at scale</li>
              <li>Upload malicious code or interfere with the Service&apos;s integrity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Disclaimers</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. BJJ App is not
              responsible for any injury or harm resulting from training activities. Always train
              under qualified supervision.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, BJJ App shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Account Deletion</h2>
            <p>
              You may delete your account at any time from the Profile page. Upon deletion, your
              training data will be permanently removed from our servers within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the Service after
              changes constitutes acceptance of the new terms. Significant changes will be announced
              in the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Contact</h2>
            <p>
              For any questions about these Terms, please contact us at the email listed on our
              GitHub profile.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6 text-xs text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">← Home</Link>
        </div>
      </div>
    </main>
  );
}

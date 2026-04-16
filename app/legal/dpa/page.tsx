import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Processing Agreement (DPA) — BJJ App",
  description:
    "Summary of our Data Processing Agreement pursuant to GDPR Article 28.",
  robots: { index: true, follow: true },
};

export default function DPAPage() {
  return (
    <main className="min-h-[100dvh] bg-zinc-950 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">
          Data Processing Agreement (DPA)
        </h1>
        <p className="text-zinc-400 text-sm mb-8">
          Summary pursuant to GDPR Article 28 — Last updated: April 2026
        </p>

        <div className="space-y-8 text-zinc-300 text-sm leading-relaxed">
          {/* §1 */}
          <Section title="1. Parties">
            <p>
              <strong className="text-white">Controller:</strong> You, the user
              of BJJ App, who determines the purposes and means of processing
              personal data.
            </p>
            <p className="mt-2">
              <strong className="text-white">Processor:</strong> Toshiki
              Terasawa (sole proprietor), operating BJJ App at bjj-app.net.
            </p>
          </Section>

          {/* §2 */}
          <Section title="2. Scope of Processing">
            <p>
              We process personal data solely to provide the BJJ App training
              tracker service. Categories of data processed include:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Account data (email, display name, avatar URL)</li>
              <li>
                Training data (session logs, technique notes, competition
                records)
              </li>
              <li>Body data (weight entries, injury records)</li>
              <li>
                Usage data (push notification tokens, cookie preferences)
              </li>
            </ul>
          </Section>

          {/* §3 */}
          <Section title="3. Sub-processors">
            <p>We use the following sub-processors:</p>
            <table className="w-full mt-2 text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="text-left py-2">Service</th>
                  <th className="text-left py-2">Purpose</th>
                  <th className="text-left py-2">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <SubRow
                  service="Supabase (AWS)"
                  purpose="Database, Auth, Storage"
                  location="US (ap-northeast-1)"
                />
                <SubRow
                  service="Vercel"
                  purpose="Hosting, Edge Functions"
                  location="Global CDN"
                />
                <SubRow
                  service="Stripe"
                  purpose="Payment processing"
                  location="US/EU"
                />
                <SubRow
                  service="Sentry"
                  purpose="Error tracking"
                  location="US"
                />
                <SubRow
                  service="Resend"
                  purpose="Transactional email"
                  location="US"
                />
                <SubRow
                  service="OpenAI"
                  purpose="AI Coach (Pro only)"
                  location="US"
                />
              </tbody>
            </table>
          </Section>

          {/* §4 */}
          <Section title="4. Data Security Measures">
            <ul className="list-disc pl-5 space-y-1">
              <li>All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
              <li>Row-Level Security (RLS) on all database tables</li>
              <li>Rate limiting on all API endpoints</li>
              <li>CSRF protection via SameSite cookies</li>
              <li>Security headers: CSP, HSTS, X-Frame-Options, Permissions-Policy</li>
              <li>Automated vulnerability scanning (npm audit, Dependabot)</li>
            </ul>
          </Section>

          {/* §5 */}
          <Section title="5. Data Subject Rights">
            <p>
              We support your exercise of data subject rights under GDPR
              Articles 15–22:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong className="text-white">Access & Portability:</strong>{" "}
                Export all your data via CSV or PDF at any time (free)
              </li>
              <li>
                <strong className="text-white">Erasure:</strong> Delete your
                account from Profile → Account. 30-day recovery period, then
                permanent deletion.
              </li>
              <li>
                <strong className="text-white">Rectification:</strong> Edit any
                personal data directly in the app
              </li>
              <li>
                <strong className="text-white">Restriction:</strong> Contact us
                to restrict processing
              </li>
            </ul>
          </Section>

          {/* §6 */}
          <Section title="6. Data Retention">
            <p>
              See our{" "}
              <Link
                href="/privacy"
                className="text-emerald-400 underline underline-offset-2"
              >
                Privacy Policy §9
              </Link>{" "}
              for detailed retention periods by data category.
            </p>
          </Section>

          {/* §7 */}
          <Section title="7. Breach Notification">
            <p>
              In the event of a personal data breach, we will notify the
              relevant supervisory authority within 72 hours (GDPR Art. 33) and
              affected data subjects without undue delay. See{" "}
              <Link
                href="/privacy"
                className="text-emerald-400 underline underline-offset-2"
              >
                Privacy Policy §11
              </Link>{" "}
              for our full incident response policy.
            </p>
          </Section>

          {/* §8 */}
          <Section title="8. Contact">
            <p>
              For DPA inquiries, data subject requests, or to request a signed
              copy of our full DPA:
            </p>
            <p className="mt-2">
              <a
                href="mailto:307239t777@gmail.com"
                className="text-emerald-400 underline underline-offset-2"
              >
                307239t777@gmail.com
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 flex flex-wrap gap-4 text-xs text-zinc-400">
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link
            href="/legal/tokushoho"
            className="hover:text-white transition-colors"
          >
            特定商取引法
          </Link>
          <Link href="/" className="hover:text-white transition-colors">
            ← Back to BJJ App
          </Link>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-white font-semibold text-base mb-2">{title}</h2>
      {children}
    </section>
  );
}

function SubRow({
  service,
  purpose,
  location,
}: {
  service: string;
  purpose: string;
  location: string;
}) {
  return (
    <tr>
      <td className="py-1.5 text-zinc-300">{service}</td>
      <td className="py-1.5 text-zinc-400">{purpose}</td>
      <td className="py-1.5 text-zinc-400">{location}</td>
    </tr>
  );
}

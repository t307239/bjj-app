import type { Metadata } from "next";
import Link from "next/link";
import GymWaitlistForm from "@/components/GymWaitlistForm";

export const metadata: Metadata = {
  title: "BJJ App for Academies - Keep Your Students Engaged",
  description:
    "Coach dashboard for BJJ academies. Track student engagement, send weekly curriculum, manage your team. $49-$99/month. No setup required.",
  keywords: [
    "BJJ academy management",
    "BJJ coach dashboard",
    "student engagement tracking",
    "BJJ gym software",
  ],
  openGraph: {
    type: "website",
    title: "BJJ App for Academies",
    description: "Keep your students engaged between classes. See who's training, push curriculum, build loyalty.",
    url: "https://bjj-app-one.vercel.app/gym",
    siteName: "BJJ App",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "BJJ App for Academies",
  description: "Academy management software for BJJ coaches and gym owners",
  url: "https://bjj-app-one.vercel.app/gym",
};

export default function GymPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen flex flex-col bg-[#0a0a18]">
        {/* Navigation */}
        <nav className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥋</span>
            <span className="font-bold text-lg">BJJ App</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              For Individuals
            </Link>
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Sign In
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#16213e] border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              For Gym Owners & Coaches
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight text-white">
              Keep Your Students
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Engaged Between Classes
              </span>
            </h1>

            <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
              Academy dashboard that tracks which students are training, sends curriculum updates, and catches at-risk dropouts
              before they leave.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="mailto:hello@bjj-app.co?subject=BJJ%20App%20Academy%20Inquiry"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
              >
                Request Access →
              </a>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-[#16213e] hover:bg-[#1a2a4a] text-gray-300 font-medium py-4 px-8 rounded-full text-lg transition-all border border-gray-700"
              >
                Learn More
              </Link>
            </div>
          </div>
        </section>

        {/* Key Features */}
        <section className="px-4 py-16 bg-[#0f0e17]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">
              What You Get
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Attrition Risk */}
              <div className="bg-[#16213e] rounded-2xl p-8 border border-gray-700 hover:border-blue-500/40 transition-colors">
                <div className="text-4xl mb-4">🔴</div>
                <h3 className="font-bold text-lg mb-3 text-gray-200">
                  Attrition Risk Dashboard
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Automatically flag students who haven't logged training in 2+ weeks. See your at-risk dropouts before they disappear.
                </p>
                <ul className="text-xs text-gray-500 space-y-2">
                  <li>✓ Real-time warning system</li>
                  <li>✓ Contact students before it's too late</li>
                  <li>✓ Reduce churn by 20-30%</li>
                </ul>
              </div>

              {/* Feature 2: Curriculum Push */}
              <div className="bg-[#16213e] rounded-2xl p-8 border border-gray-700 hover:border-blue-500/40 transition-colors">
                <div className="text-4xl mb-4">📚</div>
                <h3 className="font-bold text-lg mb-3 text-gray-200">
                  Weekly Curriculum Pushes
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Link this week's technique from BJJ Wiki. All your students see it in the app. Extend class learning to their home prep.
                </p>
                <ul className="text-xs text-gray-500 space-y-2">
                  <li>✓ Send in 30 seconds</li>
                  <li>✓ 4,000+ free BJJ Wiki pages available</li>
                  <li>✓ Increase student retention</li>
                </ul>
              </div>

              {/* Feature 3: QR Invite */}
              <div className="bg-[#16213e] rounded-2xl p-8 border border-gray-700 hover:border-blue-500/40 transition-colors">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="font-bold text-lg mb-3 text-gray-200">
                  QR Invite System
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed mb-4">
                  Generate a unique QR code for your academy. Students scan → auto-join your gym group. Zero friction onboarding.
                </p>
                <ul className="text-xs text-gray-500 space-y-2">
                  <li>✓ Print on flyers & posters</li>
                  <li>✓ Share via email/LINE</li>
                  <li>✓ Instant class integration</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="px-4 py-16 max-w-5xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-2xl mb-4">
                1️⃣
              </div>
              <h3 className="font-bold text-lg text-gray-200 mb-3">Students Download</h3>
              <p className="text-gray-400 text-sm">
                Your students get the BJJ App from the web (no app store needed). They can use it solo or join your academy group.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-2xl mb-4">
                2️⃣
              </div>
              <h3 className="font-bold text-lg text-gray-200 mb-3">Scan Your QR</h3>
              <p className="text-gray-400 text-sm">
                They scan your academy's unique QR code. Instantly linked to your gym data. No forms, no friction, done.
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-2xl mb-4">
                3️⃣
              </div>
              <h3 className="font-bold text-lg text-gray-200 mb-3">You Track & Engage</h3>
              <p className="text-gray-400 text-sm">
                See who's active, who's slipping, and send curriculum updates. Students get a stronger practice experience.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="px-4 py-16 bg-[#0f0e17]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">
              Simple Pricing
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Starter */}
              <div className="bg-[#16213e] rounded-2xl p-8 border border-gray-700">
                <h3 className="text-lg font-bold mb-2 text-gray-200">Starter</h3>
                <div className="text-3xl font-bold text-gray-200 mb-1">
                  $49<span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                <p className="text-gray-500 text-xs mb-6">Up to 50 students</p>
                <ul className="space-y-3 text-sm text-gray-400 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Attrition risk dashboard
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Weekly curriculum pushes
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> QR invite system
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Email support
                  </li>
                </ul>
                <a
                  href="mailto:hello@bjj-app.co?subject=Starter%20Plan%20Inquiry"
                  className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-full transition-all"
                >
                  Request Access
                </a>
              </div>

              {/* Pro */}
              <div className="bg-[#16213e] rounded-2xl p-8 border border-blue-500/50 relative">
                <div className="absolute -top-3 right-6 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                  Popular
                </div>
                <h3 className="text-lg font-bold mb-2 text-gray-200">Pro</h3>
                <div className="text-3xl font-bold text-gray-200 mb-1">
                  $99<span className="text-sm font-normal text-gray-500">/month</span>
                </div>
                <p className="text-gray-500 text-xs mb-6">Unlimited students</p>
                <ul className="space-y-3 text-sm text-gray-400 mb-8">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Everything in Starter
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Unlimited student groups
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Advanced analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">✓</span> Priority support
                  </li>
                </ul>
                <a
                  href="mailto:hello@bjj-app.co?subject=Pro%20Plan%20Inquiry"
                  className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-full transition-all"
                >
                  Request Access
                </a>
              </div>
            </div>
            <p className="text-gray-500 text-center text-xs mt-8">
              📩 Email us for custom plans. 14-day free trial included.
            </p>
          </div>
        </section>

        {/* Waitlist Section */}
        <section className="px-4 py-16 bg-[#16213e]/20">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-200 mb-3">
                Get Early Access
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Gym features are in private beta. Join the waitlist and we'll reach out when your spot is ready.
              </p>
            </div>
            <GymWaitlistForm />
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-16 max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-center mb-10 text-gray-200">
            Questions?
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Do students have to pay?",
                a: "No. Students use BJJ App free. You pay for the academy management features. Students benefit from curriculum pushes and their own tracking — no cost to them.",
              },
              {
                q: "Is there a setup fee?",
                a: "No setup fee. No contracts. You can cancel anytime. Get your QR code and start using it immediately after signing up.",
              },
              {
                q: "Can I use it with Stripe/PayPal for memberships?",
                a: "Right now, the app focuses on engagement & retention. We're planning payment integration for a future update. For now, use your existing payment system.",
              },
              {
                q: "Do I need technical skills?",
                a: "No. Everything is done in the browser. Generate your QR code, share it with students, send curriculum via link. That's it.",
              },
              {
                q: "What if students quit the app?",
                a: "The dashboard shows you who's active and who's not. You'll catch disengagement before students quit your academy. That's the whole point.",
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="bg-[#16213e] rounded-xl p-5 border border-gray-700">
                <h3 className="font-semibold text-gray-200 mb-2 text-sm">
                  {q}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-16 text-center bg-[#16213e]/30">
          <h2 className="text-2xl font-bold mb-3 text-gray-200">
            Ready to engage your team?
          </h2>
          <p className="text-gray-500 text-sm mb-8">
            14-day free trial. No credit card required. Cancel anytime.
          </p>
          <a
            href="mailto:hello@bjj-app.co?subject=BJJ%20App%20Academy%20Demo%20Request"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
          >
            Request Demo →
          </a>
        </section>

        {/* Footer */}
        <footer className="px-6 py-8 text-center text-gray-600 text-sm border-t border-gray-800">
          <p>© 2026 BJJ App. Built by grapplers, for grapplers.</p>
        </footer>
      </main>
    </>
  );
}

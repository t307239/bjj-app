import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "BJJ App - Brazilian Jiu-Jitsu Training Tracker | 練習トラッカー",
  description: "Track your BJJ training sessions, techniques, and streaks. Free training log for Brazilian Jiu-Jitsu practitioners. 柔術の練習記録・テクニック管理・成長の可視化。",
  keywords: ["BJJ", "Brazilian Jiu-Jitsu", "training tracker", "BJJ app", "grappling log", "technique tracker", "ブラジリアン柔術", "練習記録", "テクニック管理"],
  openGraph: {
    type: "website",
    title: "BJJ App - Track Your Brazilian Jiu-Jitsu Journey",
    description: "Log every session. Track every technique. Never forget your streak. Free BJJ training tracker.",
    url: "https://bjj-app-one.vercel.app",
    siteName: "BJJ App",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "BJJ App",
  "description": "Track your Brazilian Jiu-Jitsu training sessions, techniques, and streaks. Free BJJ training log app. 柔術の練習記録・テクニック管理・成長可視化アプリ。",
  "url": "https://bjj-app-one.vercel.app",
  "applicationCategory": "SportsApplication",
  "operatingSystem": "Web",
  "offers": [
    { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },
    { "@type": "Offer", "name": "Pro", "price": "4.99", "priceCurrency": "USD", "billingIncrement": "P1M" },
  ],
  "inLanguage": ["ja", "en"],
  "audience": { "@type": "Audience", "audienceType": "Brazilian Jiu-Jitsu practitioners" },
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <main className="min-h-screen flex flex-col">
      {/* ナビゲーション */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥋</span>
          <span className="font-bold text-lg">BJJ App</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Log in
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="max-w-2xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-[#e94560]/30 rounded-full px-4 py-1.5 text-sm text-[#e94560] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e94560] animate-pulse" />
            Free to start
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Prove your BJJ growth
            <br />
            <span className="bg-gradient-to-r from-[#e94560] to-pink-400 bg-clip-text text-transparent">
              with real data.
            </span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl mb-10 leading-relaxed">
            Track sessions, techniques, and streaks in one place.<br className="hidden md:block" />
            Every day you log is a step closer to your next belt.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-4 px-8 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#e94560]/20"
            >
              Get started free →
            </Link>
            <a
              href="#preview"
              className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-[#1a2a4a] text-gray-300 font-medium py-4 px-8 rounded-full text-lg transition-all border border-white/10"
            >
              See the app ↓
            </a>
          </div>

          <p className="text-gray-600 text-sm">
            Sign in with GitHub or Google. No credit card needed.
          </p>
          <p className="text-gray-700 text-xs mt-3">
            <Link href="/dashboard" className="hover:text-gray-500 underline transition-colors">
              Try without signing up →
            </Link>
          </p>
        </div>
      </section>

      {/* English Section — for Reddit / international users */}
      <section id="english" className="px-4 py-16 bg-[#0a0a18] border-t border-gray-800/50">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-blue-500/30 rounded-full px-4 py-1.5 text-sm text-blue-400 mb-8">
            🌐 For English speakers
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-5 leading-tight text-white">
            Stop forgetting what you learned.
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Track every technique.
            </span>
          </h2>

          <p className="text-gray-400 text-base md:text-lg mb-8 leading-relaxed">
            You drill a move. You forget it by next week.<br className="hidden md:block" />
            BJJ App fixes that — log your sessions, save techniques with mastery ratings,
            and keep your training streak alive.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center mb-10 text-sm">
            {[
              "📊 Session log (Gi / NoGi / Drilling)",
              "📚 Technique notebook",
              "🔥 Training streak",
              "🎯 Weekly & monthly goals",
              "📅 Calendar heatmap",
              "🏆 Competition W/L tracker",
            ].map((f) => (
              <span key={f} className="bg-zinc-900 border border-white/10 text-gray-300 px-3 py-1.5 rounded-full">
                {f}
              </span>
            ))}
          </div>

          {/* Testimonials — English */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-left">
            {[
              { quote: "Finally a clean BJJ tracker that isn't bloated. Exactly what I needed to stay consistent.", belt: "Blue belt, 1.5 years", initial: "M" },
              { quote: "The technique notebook is 🔥. I log every guard detail from class and review before rolling.", belt: "Purple belt, 4 years", initial: "A" },
              { quote: "Built my habit from 2x/week to 4x/week just by watching the streak number go up.", belt: "White belt, 8 months", initial: "J" },
            ].map(({ quote, belt, initial }) => (
              <div key={initial} className="bg-zinc-900 rounded-xl p-4 border border-white/10/60">
                <div className="flex items-center gap-1 mb-2 text-yellow-400 text-xs">★★★★★</div>
                <p className="text-gray-400 text-xs leading-relaxed mb-3">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-500/20 rounded-full flex items-center justify-center text-xs font-bold text-blue-300">{initial}</div>
                  <span className="text-[10px] text-gray-600">{belt}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-full text-base transition-all hover:scale-105 shadow-lg shadow-blue-600/20"
            >
              Start tracking for free →
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-[#1a2a4a] text-gray-300 font-medium py-4 px-8 rounded-full text-base transition-all border border-white/10"
            >
              Try without signing up
            </Link>
          </div>
          <p className="text-gray-700 text-xs mt-4">No credit card. Sign in with GitHub or Google. Takes 30 seconds.</p>
        </div>
      </section>

      {/* Social Proof */}
      <section className="px-4 py-16 bg-[#0f0e17]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-zinc-900 border border-[#e94560]/30 rounded-full px-4 py-2 mb-6">
              <span className="text-sm text-[#e94560]">✓ 3,500+ BJJ practitioners trust BJJ App</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-200">
              📊 Real training data
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-[#e94560]/30 text-center">
              <div className="text-3xl font-bold text-[#e94560] mb-1">5,000+</div>
              <p className="text-gray-400 text-xs">Sessions logged</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-[#e94560]/30 text-center">
              <div className="text-3xl font-bold text-[#e94560] mb-1">1,200+</div>
              <p className="text-gray-400 text-xs">Techniques saved</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-[#e94560]/30 text-center">
              <div className="text-3xl font-bold text-[#e94560] mb-1">🔥 30+</div>
              <p className="text-gray-400 text-xs">Longest streak (days)</p>
            </div>
            <div className="bg-zinc-900 rounded-2xl p-6 border border-[#e94560]/30 text-center">
              <div className="text-3xl font-bold text-[#e94560] mb-1">Free</div>
              <p className="text-gray-400 text-xs">All core features</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-12 text-gray-200">
          📈 3 steps to visible progress
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-[#e94560]/20 rounded-full text-xl mb-4">
              1️⃣
            </div>
            <h3 className="font-bold text-lg text-gray-200 mb-3">Log</h3>
            <p className="text-gray-400 text-sm">
              Record every session. Date, duration, type, and notes in seconds. Works great on mobile.
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 rounded-full text-xl mb-4">
              2️⃣
            </div>
            <h3 className="font-bold text-lg text-gray-200 mb-3">Track</h3>
            <p className="text-gray-400 text-sm">
              Your dashboard updates in real time. Streak, goal progress, and technique count at a glance.
            </p>
          </div>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500/20 rounded-full text-xl mb-4">
              3️⃣
            </div>
            <h3 className="font-bold text-lg text-gray-200 mb-3">Improve</h3>
            <p className="text-gray-400 text-sm">
              Spot your weak areas and fix them. Data proves your progress and keeps motivation high.
            </p>
          </div>
        </div>
      </section>

      {/* App Preview */}
      <section id="preview" className="px-4 py-16 bg-zinc-900/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3 text-gray-200">
            Here&apos;s what it looks like
          </h2>
          <p className="text-gray-500 text-center text-sm mb-12">Ready to use right after sign-up. All features free forever.</p>

          {/* ダッシュボードモックアップ */}
          <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
            {/* スマホモックアップ */}
            <div className="mx-auto lg:mx-0 w-full max-w-[320px] bg-[#0f172a] rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-zinc-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🥋</span>
                  <span className="text-sm font-semibold">BJJ App</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-[11px] text-gray-500">Log</span>
                  <span className="text-[11px] text-gray-500">Tech</span>
                  <span className="text-[11px] text-gray-500">Profile</span>
                </div>
              </div>

              <div className="p-4">
                {/* Greeting */}
                <div className="mb-4">
                  <h3 className="text-base font-bold">Welcome back, grappler 🥋</h3>
                  <p className="text-[11px] text-gray-500">Tuesday, March 17, 2026</p>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-2xl font-bold text-[#e94560]">12</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">This month</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-2xl font-bold text-blue-400">3</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">This week</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-2xl font-bold text-purple-400">47</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Techniques</div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 text-center border border-white/10">
                    <div className="text-xl font-bold text-orange-400">🔥 5</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Day streak</div>
                  </div>
                </div>

                {/* Goal tracker */}
                <div className="bg-zinc-900 rounded-xl border border-white/10 mb-3 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10">
                    <span className="text-xs font-medium text-gray-300">🎯 Training goals</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-gray-400">Weekly goal</span>
                        <span className="text-[10px] text-yellow-400">75%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 rounded-full" style={{ width: "75%" }} />
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">3 / 4 sessions</div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-gray-400">Monthly goal</span>
                        <span className="text-[10px] text-green-400">✓ Done!</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: "100%" }} />
                      </div>
                      <div className="text-[10px] text-gray-600 mt-1">12 / 12 sessions</div>
                    </div>
                  </div>
                </div>

                {/* Recent sessions */}
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-500 font-medium mb-1">Recent sessions</div>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">2026/03/17</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Gi</span>
                          <span className="text-[10px] text-gray-500">1h 30m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-zinc-900 rounded-xl p-3 border border-white/10 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium">2026/03/15</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">NoGi</span>
                          <span className="text-[10px] text-gray-500">1h</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature highlights */}
            <div className="flex-1 max-w-md mx-auto lg:mx-0 space-y-4 pt-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-[#e94560]/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📊</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">Log every session</h3>
                  <p className="text-gray-500 text-sm">Track Gi, NoGi, drilling, comp, and open mat. Review your calendar anytime.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🎯</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">Set weekly &amp; monthly goals</h3>
                  <p className="text-gray-500 text-sm">Track your target with a progress bar. Turns green when you hit it.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📚</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">Spot your weak areas</h3>
                  <p className="text-gray-500 text-sm">Organize techniques by position. Star ratings show where you need work.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🔥</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">Build a streak</h3>
                  <p className="text-gray-500 text-sm">Auto-counts your consecutive training days. Hard to let it break.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">📅</div>
                <div>
                  <h3 className="font-semibold text-gray-200 mb-1">Calendar view</h3>
                  <p className="text-gray-500 text-sm">See your training days on a monthly calendar with color-coded type dots.</p>
                </div>
              </div>

              <div className="pt-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-3 px-8 rounded-full transition-all hover:scale-105 w-full text-center"
                >
                  Start logging your data →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-gray-200">
          All features, free
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 hover:border-[#e94560]/40 transition-colors">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="font-bold text-lg mb-2">Training Log</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Log date, duration, type, and notes. Auto-totals your monthly sessions and training time.
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 hover:border-[#e94560]/40 transition-colors">
            <div className="text-3xl mb-3">📚</div>
            <h3 className="font-bold text-lg mb-2">Technique Journal</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Organize techniques by position. Track mastery levels to spot and fix weak areas.
            </p>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10 hover:border-[#e94560]/40 transition-colors">
            <div className="text-3xl mb-3">🔥</div>
            <h3 className="font-bold text-lg mb-2">Streak Tracker</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Automatically counts your consecutive training days. The streak keeps you coming back.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-gray-200">
          What Practitioners Say
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-1 mb-3 text-yellow-400 text-sm">★★★★★</div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              &ldquo;After 3 months of tracking, I got promoted to blue belt. Having the data makes the progress so real.&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#e94560]/20 rounded-full flex items-center justify-center text-sm">T</div>
              <div>
                <div className="text-xs font-medium text-gray-300">T.K.</div>
                <div className="text-xs text-gray-600">Blue Belt / 2 years training</div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-1 mb-3 text-yellow-400 text-sm">★★★★★</div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              &ldquo;The technique journal is awesome. I can clearly see my weak spots and focus on them next session.&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-sm">S</div>
              <div>
                <div className="text-xs font-medium text-gray-300">S.M.</div>
                <div className="text-xs text-gray-600">White Belt / 6 months training</div>
              </div>
            </div>
          </div>
          <div className="bg-zinc-900 rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-1 mb-3 text-yellow-400 text-sm">★★★★★</div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              &ldquo;The streak feature got me training 4x a week consistently. I used to quit everything after 3 days.&rdquo;
            </p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-sm">R</div>
              <div>
                <div className="text-xs font-medium text-gray-300">R.Y.</div>
                <div className="text-xs text-gray-600">Purple Belt / 5 years training</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BJJ Wiki Cross-links */}
      <section className="px-4 py-16 bg-[#0f0e17]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-200">
            📖 Deepen Your BJJ Knowledge
          </h2>
          <p className="text-gray-500 text-center text-sm mb-8">
            4,000+ pages of free BJJ technique encyclopedia — beginner to advanced
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { emoji: "🔒", title: "Guard Systems", desc: "Closed, Half, Spider, DLR", href: "https://t307239.github.io/bjj-wiki/en/bjj-guard-retention-advanced.html" },
              { emoji: "🦵", title: "Leg Locks", desc: "Heel hooks, Ashi garami, Toe holds", href: "https://t307239.github.io/bjj-wiki/en/bjj-leg-lock-system.html" },
              { emoji: "🏆", title: "Competition Mindset", desc: "Match prep, nerves, strategy", href: "https://t307239.github.io/bjj-wiki/en/bjj-competition-mindset.html" },
              { emoji: "💪", title: "Nutrition & Recovery", desc: "Diet for BJJ athletes, injury prevention", href: "https://t307239.github.io/bjj-wiki/en/bjj-nutrition-science.html" },
            ].map((item) => (
              <a
                key={item.title}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-zinc-900 rounded-xl p-4 border border-white/10 hover:border-[#e94560]/40 transition-colors block"
              >
                <div className="text-2xl mb-2">{item.emoji}</div>
                <div className="text-sm font-semibold text-gray-200 mb-1">{item.title}</div>
                <div className="text-[11px] text-gray-500">{item.desc}</div>
              </a>
            ))}
          </div>
          <div className="text-center">
            <a
              href="https://t307239.github.io/bjj-wiki/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#e94560] hover:text-red-400 transition-colors text-sm font-medium"
            >
              Explore all of BJJ Wiki → <span className="text-xs text-gray-500">(free)</span>
            </a>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-4 py-16 bg-[#0f0e17]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-3 text-gray-200">
            Simple Pricing
          </h2>
          <p className="text-gray-500 text-center text-sm mb-10">All core features are free forever.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Free */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-white/10">
              <div className="text-lg font-bold mb-1">Free</div>
              <div className="text-3xl font-bold text-gray-200 mb-1">$0</div>
              <div className="text-gray-500 text-xs mb-6">Free forever</div>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Training log (unlimited)</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Technique journal</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Goal tracker</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Calendar &amp; graphs</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Streak tracking</li>
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Competition records</li>
              </ul>
              <Link href="/login" className="mt-8 block text-center bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-3 rounded-full transition-all">
                Get started free
              </Link>
            </div>
            {/* Pro */}
            <div className="bg-zinc-900 rounded-2xl p-8 border border-[#e94560]/50 relative">
              <div className="absolute -top-3 right-6 bg-[#e94560] text-white text-xs px-3 py-1 rounded-full font-bold">Coming soon</div>
              <div className="text-lg font-bold mb-1">Pro</div>
              <div className="text-3xl font-bold text-gray-200 mb-1">$4.99<span className="text-sm font-normal text-gray-500">/mo (tax incl.)</span></div>
              <div className="text-gray-500 text-xs mb-6">Billed monthly</div>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="text-green-400">✓</span> Everything in Free</li>
                <li className="flex items-center gap-2"><span className="text-[#e94560]">★</span> CSV export</li>
                <li className="flex items-center gap-2"><span className="text-[#e94560]">★</span> 12-month graphs</li>
                <li className="flex items-center gap-2"><span className="text-[#e94560]">★</span> Streak freeze</li>
                <li className="flex items-center gap-2"><span className="text-[#e94560]">★</span> Priority support</li>
              </ul>
              <button className="mt-8 w-full text-center bg-white/10 text-gray-400 font-bold py-3 rounded-full cursor-not-allowed" disabled>
                Coming soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-center mb-10 text-gray-200">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            { q: "Is it really free?", a: "Yes, all core features are completely free. Training log, technique journal, goal tracker, calendar, and graphs are all free. Pro features (CSV export, 12-month graphs, streak freeze) are $4.99/month." },
            { q: "Is this good for beginners?", a: "Absolutely! White belts and blue belts are the perfect users. Built to solve two common problems: not remembering technique names, and staying consistent. Logging from day one makes the path to your next belt visible." },
            { q: "How is this different from a notebook?", a: "Three key differences: (1) Automatic streak counting — never lose momentum, (2) Visual graphs — see your growth in numbers, (3) BJJ Wiki integration — instantly look up any technique from 4,000+ pages. Data proves your progress." },
            { q: "Does it work on mobile?", a: "Yes! Fully responsive and works great in your smartphone browser. Add it to your home screen to use it like a native app. Offline support is also planned." },
            { q: "Is my data safe?", a: "Data is stored securely in Supabase (enterprise-grade PostgreSQL). Row Level Security means no one can access your data. Export everything as CSV anytime — no lock-in." },
          ].map(({ q, a }, i) => (
            <div key={i} className="bg-zinc-900 rounded-xl p-5 border border-white/10">
              <h3 className="font-semibold text-gray-200 mb-2 text-sm">Q. {q}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-16 text-center bg-zinc-900/30">
        <h2 className="text-2xl font-bold mb-3 text-gray-200">Start Training Smarter Today</h2>
        <p className="text-gray-500 text-sm mb-8">No credit card needed. Sign up with GitHub or Google in seconds.</p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 bg-[#e94560] hover:bg-[#c73652] text-white font-bold py-4 px-10 rounded-full text-lg transition-all hover:scale-105 shadow-lg shadow-[#e94560]/20"
        >
          Get started free →
        </Link>
      </section>

      {/* フッター */}
      <footer className="px-6 py-8 text-center text-gray-600 text-sm border-t border-gray-800">
        <p className="mb-3">© 2026 BJJ App. Made for grapplers, by grapplers.</p>
        <div className="flex justify-center flex-wrap gap-4 text-xs">
          <a href="/terms" className="hover:text-gray-400 transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy</a>
          <a href="/legal/tokushoho" className="hover:text-gray-400 transition-colors">特定商取引法に基づく表記</a>
        </div>
      </footer>
    </main>
    </>
  );
}

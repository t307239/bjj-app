import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const ogImage = `${BASE_URL}/api/og?mode=invite`;
  const title = "Your Training Partner Invited You to BJJ App";
  const description =
    "Track BJJ sessions, master techniques, and build your skill map — free forever. Join your partner on BJJ App.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: "BJJ App Invite" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    // Suppress indexing of invite pages — they're personal links
    robots: { index: false, follow: false },
  };
}

const FEATURES = [
  { emoji: "📋", text: "Training session log + streaks" },
  { emoji: "🗺️", text: "Skill map — visualize your BJJ journey" },
  { emoji: "🎯", text: "Weekly goals & progress analytics" },
  { emoji: "🥋", text: "Technique journal with mastery levels" },
];

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const loginUrl = `/login?ref=${encodeURIComponent(code)}`;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <span className="text-4xl">🥋</span>
        <span className="text-2xl font-black text-white tracking-tight">BJJ App</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-zinc-900/60 border border-white/10 rounded-3xl p-8 shadow-2xl">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
          <span>🤝</span> Personal Invite
        </div>

        <h1 className="text-2xl font-black text-white leading-tight mb-3">
          Your training partner invited you to BJJ App
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          The #1 training tracker for BJJ athletes. Log sessions, build your skill map,
          and crush your goals — completely free.
        </p>

        {/* Feature list */}
        <ul className="space-y-3 mb-8">
          {FEATURES.map((f) => (
            <li key={f.text} className="flex items-center gap-3 text-sm text-zinc-300">
              <span className="text-lg flex-shrink-0">{f.emoji}</span>
              {f.text}
            </li>
          ))}
        </ul>

        {/* Primary CTA */}
        <Link
          href={loginUrl}
          className="block w-full text-center py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-base transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
        >
          Start Free — Accept Invite
        </Link>

        {/* Secondary */}
        <p className="text-center text-xs text-zinc-500 mt-4">
          Already have an account?{" "}
          <Link href={loginUrl} className="text-zinc-300 hover:text-white underline">
            Sign in →
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="text-zinc-600 text-xs mt-10">
        bjj-app.net · Free forever · No credit card required
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { detectServerLocale, makeT } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

type Props = {
  params: Promise<{ code: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  const locale = await detectServerLocale();
  const t = makeT(locale);
  const ogImage = `${BASE_URL}/api/og?mode=invite`;
  const title = t("invite.title");
  const description = t("invite.subtitle");
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

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const loginUrl = `/login?ref=${encodeURIComponent(code)}`;
  const locale = await detectServerLocale();
  const t = makeT(locale);

  const features: { emoji: string; text: string }[] = [
    { emoji: "📋", text: t("invite.feature1") },
    { emoji: "🗺️", text: t("invite.feature2") },
    { emoji: "🎯", text: t("invite.feature3") },
    { emoji: "🥋", text: t("invite.feature4") },
  ];

  return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <span className="text-4xl">🥋</span>
        <span className="text-2xl font-black text-white tracking-tight">BJJ App</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-zinc-900/60 border border-white/10 rounded-3xl p-8 shadow-2xl">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-violet-600/20 border border-violet-500/30 text-violet-300 text-xs font-bold px-3 py-1.5 rounded-full mb-6">
          <span>🤝</span> {t("invite.personalBadge")}
        </div>

        <h1 className="text-2xl font-black text-white leading-tight mb-3">
          {t("invite.title")}
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          {t("invite.subtitle")}
        </p>

        {/* Feature list */}
        <ul className="space-y-3 mb-8">
          {features.map((f) => (
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
          {t("invite.ctaPrimary")}
        </Link>

        {/* Secondary */}
        <p className="text-center text-xs text-zinc-500 mt-4">
          {t("invite.alreadyHaveAccount")}{" "}
          <Link href={loginUrl} className="text-zinc-300 hover:text-white underline">
            {t("invite.signIn")}
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="text-zinc-600 text-xs mt-10">
        {t("invite.footer")}
      </p>
    </div>
  );
}

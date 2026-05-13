import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/safeJsonLd";
import { detectServerLocale } from "@/lib/i18n";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

// z260f: locale-aware metadata (BACKLOG F-12 続き)
// 旧: static JA-only (「ログイン」「BJJ App にログインして...」) → EN/PT user の
// SERP / share preview で日本語表示 → SEO 機会損失 + non-JP user に不親切
// 修正: detectServerLocale で 3 locale 出し分け
const LOGIN_META = {
  en: {
    title: "Login",
    desc: "Log in to BJJ App to record and manage your daily Jiu-Jitsu training. One-click login with Google or GitHub.",
    ogTitle: "Login | BJJ App",
    ogDesc: "Log in to BJJ App to record and manage your daily Jiu-Jitsu training.",
    schemaName: "Login | BJJ App",
  },
  ja: {
    title: "ログイン",
    desc: "BJJ App にログインして、毎日の柔術練習を記録・管理しましょう。Google / GitHub でワンクリックログイン。",
    ogTitle: "ログイン | BJJ App",
    ogDesc: "BJJ App にログインして、毎日の柔術練習を記録・管理しましょう。",
    schemaName: "ログイン | BJJ App",
  },
  pt: {
    title: "Entrar",
    desc: "Entre no BJJ App para registrar e gerenciar seu treino diário de Jiu-Jitsu. Login com um clique pelo Google ou GitHub.",
    ogTitle: "Entrar | BJJ App",
    ogDesc: "Entre no BJJ App para registrar e gerenciar seu treino diário de Jiu-Jitsu.",
    schemaName: "Entrar | BJJ App",
  },
} as const;

const LOGIN_OG_IMAGE = `${BASE_URL}/api/og?belt=white&count=0&months=0&streak=0&mode=lp`;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await detectServerLocale();
  const m = LOGIN_META[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];
  return {
    // root layout.tsx の template "%s | BJJ App" が自動付与するので suffix 重複回避
    title: m.title,
    description: m.desc,
    openGraph: {
      title: m.ogTitle,
      description: m.ogDesc,
      url: `${BASE_URL}/login`,
      siteName: "BJJ App",
      type: "website",
      images: [{
        url: LOGIN_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "BJJ App - Login",
      }],
      locale: locale === "ja" ? "ja_JP" : locale === "pt" ? "pt_BR" : "en_US",
    },
    twitter: {
      card: "summary",
      title: m.ogTitle,
      description: m.ogDesc,
    },
  };
}

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await detectServerLocale();
  const m = LOGIN_META[locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en"];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: m.schemaName,
    description: m.desc,
    url: `${BASE_URL}/login`,
    inLanguage: locale === "ja" ? "ja" : locale === "pt" ? "pt" : "en",
    isPartOf: {
      "@type": "SoftwareApplication",
      name: "BJJ App",
      url: BASE_URL,
    },
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      {children}
    </>
  );
}

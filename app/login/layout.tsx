import type { Metadata } from "next";
import { safeJsonLd } from "@/lib/safeJsonLd";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export const metadata: Metadata = {
  // root layout.tsx の template "%s | BJJ App" が自動付与するので suffix 重複回避
  title: "ログイン",
  description:
    "BJJ App にログインして、毎日の柔術練習を記録・管理しましょう。Google / GitHub でワンクリックログイン。",
  openGraph: {
    title: "ログイン | BJJ App",
    description:
      "BJJ App にログインして、毎日の柔術練習を記録・管理しましょう。",
    url: `${BASE_URL}/login`,
    siteName: "BJJ App",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ログイン | BJJ App",
    description:
      "BJJ App にログインして、毎日の柔術練習を記録・管理しましょう。",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "ログイン | BJJ App",
  description:
    "BJJ App にログインして、毎日の柔術練習を記録・管理しましょう。Google / GitHub でワンクリックログイン。",
  url: `${BASE_URL}/login`,
  isPartOf: {
    "@type": "WebApplication",
    name: "BJJ App",
    url: BASE_URL,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

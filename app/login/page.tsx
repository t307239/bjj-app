import type { Metadata } from "next";
import LoginClient from "./LoginClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app-one.vercel.app";

export const metadata: Metadata = {
  title: "ログイン | BJJ App",
  description: "BJJ練習記録アプリ『BJJ App』にログイン。Googleアカウントでかんたんサインイン。",
  openGraph: {
    title: "ログイン | BJJ App",
    description: "BJJ練習記録アプリ『BJJ App』にログイン",
    url: `${BASE_URL}/login`,
    siteName: "BJJ App",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "ログイン | BJJ App",
    description: "BJJ練習記録アプリにGoogleアカウントでサインイン",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "ログイン | BJJ App",
  "description": "BJJ練習記録アプリ『BJJ App』にログイン",
  "url": `${BASE_URL}/login`,
  "potentialAction": {
    "@type": "LoginAction",
    "target": `${BASE_URL}/login`,
  },
};

export default function LoginPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LoginClient />
    </>
  );
}

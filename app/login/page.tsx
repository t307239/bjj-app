import type { Metadata } from "next";
import LoginClient from "./LoginClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app-one.vercel.app";

export const metadata: Metadata = {
  title: "Sign In | BJJ App",
  description: "Sign in to BJJ App — your Brazilian Jiu-Jitsu training tracker. Log sessions, track techniques, and never miss a streak.",
  openGraph: {
    title: "Sign In | BJJ App",
    description: "Sign in to your BJJ training tracker",
    url: `${BASE_URL}/login`,
    siteName: "BJJ App",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sign In | BJJ App",
    description: "Sign in to BJJ App — track your BJJ training",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Sign In | BJJ App",
  "description": "Sign in to BJJ App — Brazilian Jiu-Jitsu training tracker",
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

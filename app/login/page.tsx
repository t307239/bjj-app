// z260g: metadata は layout.tsx の generateMetadata に委譲 (locale-aware + og:image)
// 旧: 静的 metadata export が layout の generateMetadata を上書きしており
//     /login で og:image / og:locale が消えていた (live audit で発覚)
// JSON-LD の LoginAction は layout の WebPage schema に統合
import { safeJsonLd } from "@/lib/safeJsonLd";
import LoginClient from "./LoginClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

// 補足 JSON-LD: LoginAction (layout の WebPage schema を補完)
const loginActionJsonLd = {
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
        dangerouslySetInnerHTML={{ __html: safeJsonLd(loginActionJsonLd) }}
      />
      <LoginClient />
    </>
  );
}

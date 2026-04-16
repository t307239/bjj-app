import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CookieConsent from "@/components/CookieConsent";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import AgeGate from "@/components/AgeGate";
import LocaleProvider from "@/components/LocaleProvider";
import { detectServerLocale } from "@/lib/i18n";
import "./globals.css";

// #41: Next/Font — Google Fonts をビルド時にセルフホスティング化（FOUT/FOIT 防止）
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bjj-app.net";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    template: "%s | BJJ App",
  },
  description:
    "Track your Brazilian Jiu-Jitsu training — log sessions, record techniques, maintain streaks, and visualize your progress.",
  manifest: "/manifest.json",
  keywords: ["BJJ", "Brazilian Jiu-Jitsu", "training tracker", "technique log", "martial arts"],
  authors: [{ name: "BJJ App" }],
  alternates: {
    canonical: "/",
    languages: {
      "en": "/",
      "ja": "/",
      "pt": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    description: "Track your BJJ training — log sessions, record techniques, and grow.",
    siteName: "BJJ App",
    url: BASE_URL,
    images: [
      {
        url: "/api/og?belt=white&count=0&months=0&streak=0&mode=lp",
        width: 1200,
        height: 630,
        alt: "BJJ App - Track Your Jiu-Jitsu Journey",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BJJ App",
    description: "Track your BJJ training — log sessions, record techniques, and grow.",
    images: ["/api/og?belt=white&count=0&months=0&streak=0&mode=lp"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BJJ App",
  },
  robots: {
    index: true, // LPはGoogle検索対象（ダッシュボードは認証保護）
    follow: true,
  },
  verification: {
    google: "fnH74hZXRuzUw4kAupmkh0kBkvLL1b4C8ZxOtayWieA",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Detect locale on server (cookie → Accept-Language → "en")
  // Passed to LocaleProvider to align SSR and client _clientLocale → fixes #418
  const locale = await detectServerLocale();

  return (
    // #48: dark クラスを固定 — Tailwind の dark: modifier を常に有効化
    <html lang={locale} className={`dark ${inter.variable} overscroll-none`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      {/* #41: font-sans → Inter variable font */}
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-white antialiased overscroll-none`}>
        {/* Q-2: Skip navigation for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-emerald-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
        >
          Skip to main content
        </a>
        {/* I-14: LocaleProvider aligns _clientLocale with server-detected locale
            before any children render → eliminates Hydration Error #418 */}
        <LocaleProvider locale={locale}>
          <AgeGate />
          <main id="main-content">
            {children}
          </main>
          <CookieConsent />
          <Analytics />
          <SpeedInsights />
          <WebVitalsReporter />
        </LocaleProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{/* SW registration optional */})}`,
          }}
        />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// #41: Next/Font — Google Fonts をビルド時にセルフホスティング化（FOUT/FOIT 防止）
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    template: "%s | BJJ App",
  },
  description:
    "Track your Brazilian Jiu-Jitsu training — log sessions, record techniques, maintain streaks, and visualize your progress.",
  manifest: "/manifest.json",
  keywords: ["BJJ", "Brazilian Jiu-Jitsu", "training tracker", "technique log", "martial arts"],
  authors: [{ name: "BJJ App" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    description: "Track your BJJ training — log sessions, record techniques, and grow.",
    siteName: "BJJ App",
  },
  twitter: {
    card: "summary",
    title: "BJJ App",
    description: "Track your BJJ training — log sessions, record techniques, and grow.",
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
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // #48: dark クラスを固定 — Tailwind の dark: modifier を常に有効化
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      {/* #41: font-sans → Inter variable font */}
      <body className={`${inter.className} min-h-screen bg-zinc-950 text-white antialiased`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`,
          }}
        />
      </body>
    </html>
  );
}

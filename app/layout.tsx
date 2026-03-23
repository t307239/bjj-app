import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    index: true,  // LPはGoogle検索対象（ダッシュボードは認証保護）
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
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="min-h-screen bg-[#0f172a] text-white antialiased">
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

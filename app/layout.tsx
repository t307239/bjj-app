import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    template: "%s | BJJ App",
  },
  description:
    "Brazilian Jiu-Jitsuの練習を記録・管理・分析。練習回数・テクニック・連続記録を追跡してあなたの成長を可視化。",
  manifest: "/manifest.json",
  keywords: ["BJJ", "ブラジリアン柔術", "練習記録", "テクニック管理", "格闘技"],
  authors: [{ name: "BJJ App" }],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    title: "BJJ App - Brazilian Jiu-Jitsu Tracker",
    description: "BJJの練習を記録・管理・成長させよう",
    siteName: "BJJ App",
  },
  twitter: {
    card: "summary",
    title: "BJJ App",
    description: "BJJの練習を記録・管理・成長させよう",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BJJ App",
  },
  robots: {
    index: false, // プライベートアプリのためインデックス不要
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
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
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="min-h-screen bg-[#1a1a2e] text-white antialiased">
        {children}
      </body>
    </html>
  );
}

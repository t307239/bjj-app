import type { Metadata } from "next";
import type { ReactNode } from "react";

// ROBUST ジム専用の PWA 設定。
// Why: 本体アプリ(個人向けBJJトラッカー)の manifest は start_url が /dashboard を指すため、
//      ROBUST 会員がホーム(PWA起動/ホーム戻り)で本体ダッシュボードへ飛んでしまう。
//      ここで manifest を ROBUST 専用(scope/start_url を /gym/robust に限定)へ上書きし、
//      ジムの内側だけで完結させる。root の metadata はマージされ、ここで指定した項目のみ上書き。
export const metadata: Metadata = {
  manifest: "/robust.webmanifest",
  title: {
    default: "ROBUST 柔術",
    template: "%s | ROBUST 柔術",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ROBUST 柔術",
  },
};

export default function RobustLayout({ children }: { children: ReactNode }) {
  return children;
}

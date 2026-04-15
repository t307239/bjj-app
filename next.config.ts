import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const analyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  // #23: Vercelツールバーを本番環境で非表示（dev環境のみ有効）
  vercelToolbar: process.env.NODE_ENV === "development",
  // Q-6: next/image remote patterns for avatars and YouTube thumbnails
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
    ],
  },
  // cssnano がTailwindのスラッシュ構文(border-white/10等)でクラッシュする問題を回避
  experimental: {
    optimizeCss: false,
  },
  // セキュリティヘッダー設定
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // CSP: Next.js インラインスクリプトを壊さない安全な基底のみ
          // script-src は Next.js hydration の unsafe-inline/eval が必要なため設定しない
          // 将来 nonce ベース CSP に移行する場合はここを拡張する
          {
            key: "Content-Security-Policy",
            value: [
              "frame-ancestors 'none'",   // X-Frame-Options より強力なフレーム埋め込み禁止
              "object-src 'none'",        // Flash / プラグイン完全禁止
              "base-uri 'self'",          // <base>タグ書き換えによるフィッシング防止
            ].join("; "),
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default analyzer(nextConfig);

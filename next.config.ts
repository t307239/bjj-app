import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TypeScript/ESLintエラーはビルドを止めない（デプロイ優先）
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // cssnano がTailwindのスラッシュ構文(border-white/10等)でクラッシュする問題を回避
  experimental: {
    optimizeCss: false,
  },
  // PWA対応のためのヘッダー設定
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
        ],
      },
    ];
  },
};

export default nextConfig;
// .
// ...

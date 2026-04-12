# BJJ App — バックログ

---

## 🔴 アクティブタスク

### [SEC-1] esbuild / vite / vitest セキュリティ脆弱性（moderate × 4）
- **概要**: `esbuild ≤0.24.2` が開発サーバーへの任意リクエスト送信を許可する脆弱性（GHSA-67mh-4wv8-2f99）
- **影響範囲**: `vite → vite-node → vitest` のチェーン（開発環境のみ、本番ビルドに影響なし）
- **修正方法**: `vitest` を `^4.x` にメジャーアップデート（`npm audit fix --force` は禁止のため手動対応必要）
- **優先度**: 中（開発環境限定・本番非影響）
- **追加日**: 2026-04-12

---

## 🟡 メジャーバージョンアップ待ち（要調査・手動対応）

### [DEP-1] Next.js 15 → 16
- **現状**: `15.5.15` / Latest: `16.2.3`
- **調査ポイント**: App Router の破壊的変更、React 19 対応状況
- **対応方針**: マイグレーションガイド確認後に着手

### [DEP-2] Tailwind CSS 3 → 4
- **現状**: `3.4.19` / Latest: `4.2.2`
- **調査ポイント**: 設定ファイル形式変更（CSS-first config）、ユーティリティクラス互換性
- **対応方針**: 全 Tailwind クラスの互換性検証が必要。大規模変更のため慎重に計画

### [DEP-3] Stripe SDK 17 → 22
- **現状**: `17.7.0` / Latest: `22.0.1`
- **調査ポイント**: API の破壊的変更、型定義の変更
- **対応方針**: Stripe Changelog で v18〜v22 の変更点を確認してから実施

### [DEP-4] TypeScript 5 → 6
- **現状**: `5.9.3` / Latest: `6.0.2`
- **調査ポイント**: 型チェック厳格化による既存コードへの影響
- **対応方針**: `tsc --noEmit` でエラー件数を事前確認

### [DEP-5] Vitest 2 → 4（SEC-1 と同時解決）
- **現状**: `2.1.9` / Latest: `4.1.4`（`@vitest/coverage-v8` も同様）
- **対応方針**: SEC-1 対応と合わせて実施

### [DEP-6] ESLint 9 → 10
- **現状**: `9.39.4` / Latest: `10.2.0`
- **対応方針**: eslint-config-next の対応状況確認後に実施

### [DEP-7] @vercel/analytics 1 → 2 / @vercel/speed-insights 1 → 2
- **現状**: `1.6.1` / `1.3.1` → Latest: `2.0.1` / `2.0.0`
- **対応方針**: Vercel ドキュメントで API 変更点を確認

### [DEP-8] @types/node 20 → 25
- **現状**: `20.19.39` / Latest: `25.6.0`
- **対応方針**: Node.js 20 サポート期間中は据え置き可

### [DEP-9] @supabase/ssr 0.5.2 → 0.10.2
- **現状**: `0.5.2` / Latest: `0.10.2`（マイナーだが API 変更あり可能性）
- **対応方針**: Supabase changelog 確認後、@supabase/supabase-js と合わせて更新

---

## ✅ 月次監査ログ

### 2026-04 月次依存パッケージ監査
```
npm audit:
  critical: 0件  high: 0件（修正済）  moderate: 4件  low: 0件

修正済み（npm audit fix で自動対応）:
  - next: 15.5.13 → 15.5.15（高: Disk cache DoS / Server Components DoS）
  - lodash: 間接依存を解消（高: テンプレートインジェクション / プロトタイプ汚染）
  - picomatch: 間接依存を解消（高: ReDoS / Method Injection）
  - brace-expansion: 間接依存を解消（moderate: Zero-step DoS）

残存（要メジャーアップデート）:
  - esbuild ≤0.24.2 → vitest 4.x へのアップグレードで解決

npm outdated 主要パッケージ:
  メジャー更新: next(16), tailwindcss(4), stripe(22), typescript(6), vitest(4), eslint(10)
  マイナー更新: @supabase/ssr(0.10.2)
  パッチ更新: postcss, react, react-dom, @xyflow/react
    ※ package.json の ^ 範囲内のため npm install で自動解決
```

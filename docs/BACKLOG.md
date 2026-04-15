# BJJ App — 依存パッケージ管理・技術スタック更新

> 機能バックログは `~/Claude/docs/BACKLOG.md` を参照。

---

## 🟡 メジャーバージョンアップ待ち（要調査・手動対応）

### [DEP-1] Next.js 15 → 16 ⚠️ 大規模マイグレーション
- **現状**: `15.5.15` / Latest: `16.2.3`
- **破壊的変更**: async Request API必須化、middleware→proxy rename、Turbopackデフォルト化、PPR廃止→cacheComponents、next/image defaults変更
- **対応方針**: `npx @next/codemod@canary upgrade latest` で自動マイグレーション → 手動修正。別セッションで計画的に実施

### [DEP-2] Tailwind CSS 3 → 4 ⚠️ 大規模マイグレーション
- **現状**: `3.4.19` / Latest: `4.2.2`
- **破壊的変更**: JS config→CSS config、PostCSS plugin分離(@tailwindcss/postcss)、autoprefixer不要、bg-gradient-to-*→bg-linear-to-*、dark mode default変更
- **対応方針**: 公式 upgrade tool で自動変換 → 全ページ視覚確認。DEP-1と同時にやると効率的

### [DEP-3] Stripe SDK 17 → 22
- **現状**: `17.7.0` / Latest: `22.0.1`
- **対応方針**: 5メジャーバージョン分のChangelog確認が必要。Stripe課金機能が安定稼働してから実施

### [DEP-6] ESLint 9 → 10
- **現状**: `9.39.4` / Latest: `10.2.0`
- **対応方針**: eslint-config-next の対応状況確認後に実施

### [DEP-9] @supabase/ssr 0.5.2 → 0.10.2
- **現状**: `0.5.2` / Latest: `0.10.2`（ベータ、API不安定の可能性）
- **対応方針**: v1.0.0正式リリース待ち、または Supabase changelog 確認後に慎重に更新

---

## ✅ 完了済み（2026-04-12）

### [SEC-1] esbuild脆弱性 → vitest ^4.0.0 で解決 ✅
### [DEP-4] TypeScript 5→6 → ^6 に更新 ✅
### [DEP-5] Vitest 2→4 → ^4.0.0 に更新 ✅
### [DEP-7] @vercel/analytics 1→2, speed-insights 1→2 → ^2.0.0 に更新 ✅
### [DEP-8] @types/node 20→22 → ^22 に更新 ✅
※ いずれもpackage.json更新済み。ローカルで `npm install` 実行が必要

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
  - esbuild ≤0.24.2 → vitest 4.x へのアップグレードで解決予定（package.json更新済み）

npm outdated 主要パッケージ:
  メジャー更新: next(16), tailwindcss(4), stripe(22), eslint(10)
  マイナー更新: @supabase/ssr(0.10.2)
  パッチ更新: postcss, react, react-dom, @xyflow/react
    ※ package.json の ^ 範囲内のため npm install で自動解決
```

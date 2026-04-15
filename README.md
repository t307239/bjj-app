# BJJ App 🥋

Brazilian Jiu-Jitsu トレーニングトラッカー — 練習記録・テクニック管理・スキルマップを一つのアプリで。

**本番**: [bjj-app.net](https://bjj-app.net)
**Wiki**: [wiki.bjj-app.net](https://wiki.bjj-app.net)

## 主な機能

- **練習記録** — 日付・時間・タイプ（Gi/No-Gi/Drilling/Open Mat）・メモ・指導者・パートナーを記録。フルテキスト検索・PDFエクスポート・ディープリンク対応
- **テクニック帳** — カテゴリ別に技を管理。習熟度3段階（Locked/Learning/Mastered）、一括追加、ピン留め
- **スキルマップ** — React Flow ベースの技術マップ。ノード接続・折りたたみ・自動レイアウト（dagre）・ポジションフィルター・エッジメモ
- **ダッシュボード** — ヒートマップカレンダー・週次レポート・練習目標・帯進捗・ステータスバー・インサイト
- **ボディヒートマップ** — 前面/背面ビューで怪我・疲労部位を記録
- **大会管理** — 大会履歴・試合結果の記録
- **怪我トラッキング** — Gi/No-Gi別の怪我記録・再発検知アラート
- **10,000時間トラッカー** — 累計練習時間の可視化
- **オンボーディング** — 初回ログイン時のステップバイステップガイド、フォーカスカード
- **PWA** — スマホにインストール可能、オフライン対応準備済み
- **多言語対応** — 日本語・英語・ポルトガル語（i18n）
- **Pro/Free課金** — Stripe連携。Free: 基本機能 / Pro: 全機能解放

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) / React 19 / TypeScript 6 |
| スタイリング | Tailwind CSS 3 |
| DB / 認証 | Supabase (PostgreSQL + Auth + RLS) |
| デプロイ | Vercel |
| スキルマップ | @xyflow/react (React Flow) |
| バリデーション | zod |
| エラー監視 | Sentry |
| 課金 | Stripe |
| Linter | ESLint + Prettier + lint-staged |

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数（.env.local）
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# 開発サーバー起動
npm run dev
```

## プロジェクト構成

```
bjj-app/
├── app/              # Next.js App Router ページ
├── components/       # UIコンポーネント
│   └── skillmap/     # スキルマップ関連（TechniqueNode, BottomDrawer等）
├── hooks/            # カスタムフック（useTrainingLog, useSkillMap等）
├── lib/              # ユーティリティ（i18n, supabase client, validation等）
│   └── api/          # Supabaseクエリ集約レイヤー
├── messages/         # i18nファイル（en.json, ja.json, pt.json）
├── public/           # 静的アセット・PWAマニフェスト
├── scripts/          # 運用ツール（detect_hidden_bugs.py等）
└── docs/             # 機能PRD
```

## 品質管理

```bash
# 型チェック
npx tsc --noEmit

# 隠れバグ検出（i18n漏れ・セキュリティ・パフォーマンス）
python3 scripts/detect_hidden_bugs.py --fix-hint
```

## ライセンス

Private

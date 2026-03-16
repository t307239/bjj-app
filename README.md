# BJJ App 🥋

Brazilian Jiu-Jitsu トレーニングトラッカー

## セットアップ

### 1. 依存関係インストール

```bash
npm install
```

### 2. 環境変数

`.env.local` にSupabase情報を設定（既に設定済み）:

```
NEXT_PUBLIC_SUPABASE_URL=https://ryevkjaoppsyibkjifjk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_7c0qKKajk6pD2OpxRAU3LQ_-cFKZ_V3
```

### 3. Supabaseでテーブル作成

Supabase Dashboard → SQL Editor で `supabase-schema.sql` を実行

### 4. OAuth プロバイダー設定

Supabase Dashboard → Authentication → Providers で設定:
- **Google**: Google Cloud Console で OAuth 2.0 クライアントIDを作成
- **GitHub**: GitHub Settings → Developer settings → OAuth Apps で作成
- Callback URL: `https://ryevkjaoppsyibkjifjk.supabase.co/auth/v1/callback`

### 5. 開発サーバー起動

```bash
npm run dev
```

### 6. Vercelデプロイ

```bash
# GitHubにpush後、Vercelでインポート
# 環境変数をVercelダッシュボードで設定
```

## 機能

- Google / GitHub ソーシャルログイン
- 練習記録（日付・時間・タイプ・メモ）
- テクニック帳（カテゴリ・習熟度管理）
- PWA対応（スマホにインストール可能）

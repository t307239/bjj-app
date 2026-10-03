# ROBUST 会員管理アプリ — 全体メモ（新規チャットの前提知識）

> 新しい会話の冒頭で「docs/ROBUST.md を読んで」と伝えれば、同じ説明を繰り返さずに済む。
> 変更したらここも更新する（コード・DB・運用ルールのいずれか）。

## 概要

- 柔術ジム ROBUST の会員管理 Web アプリ（Next.js 15）。bjj-app 本体の `app/gym/robust` 配下。
- 本番: https://bjj-app.net / https://app.robust-bjj.jp（Vercel project `bjj-app`、関数リージョン hnd1 固定）
- DB: Supabase `gym-member-hub`（ref `klcejhhkqsziwxpyyfba`, 東京）。bjj-app 本体 DB（ap-south-1）とは別。
- 決済: Stripe（現在 TEST モード）。税率は外税10%。

## 画面と入口

- 会員: `/gym/robust/register`（新規登録・ログイン、`?mode=login`）→ `member/qr`（入館QR）, `profile`, `history`, `billing`, `videos`, `announcements`
- オーナー／スタッフ: **`/gym/robust/admin` から入る運用ルール**（会員用ログインから入ると会員QR画面に着地する）
  - `admin`（ダッシュボード）, `admin/members`（会員管理）, `admin/attendance`（出欠）, `admin/videos`, `admin/staff`, `admin/notify`
- チェックイン: `/gym/robust/checkin`、パスワード再設定: `/gym/robust/reset-password`（再設定後は自動ログインせず、ログイン画面へ）

## コード構成

- API: `app/api/gym/robust/*`（admin, attendance, export, member, members, push, role, settings, staff, videos）、登録は `app/api/gym/register`
- ライブラリ: `lib/robust/*`（auth=権限ガード `requireRobustManager`, plans=プラン・税率, labels=表示ラベル, payments, drive, push）
- 部品: `components/robust/*`、管理画面の分割部品は `components/robust/admin/*`（MemberEditForm, MemberDetailPanel, CardLinkPanel, DriveAccessPanel, AttendanceCsvExport）
- 権限: owner > admin/instructor > instructor。GET が会員も通す点に注意（詳細は memory の reference_robust_authz）

## 運用ルール・注意点

- 帯・ストライプを変えて保存すると昇格履歴（belt_history）に1行追記される。**画面からは削除できない**ため、本番データで試さない。
- 動画は Google Drive の手動共有運用（管理画面に共有対象メール一覧）。
- ストア（App Store / Google Play）掲載はしない方針。Webアプリ（ホーム画面に追加）で代替。
- テスト会員は `+rb-` 付きの Gmail エイリアス。テスト用ログイン情報は引き渡しドキュメント側に記載。

## 開発ルール（要点）

- コミット: `.git/CLAUDE_COMMIT_MSG` を書いてから `git add -A && git commit -F .git/CLAUDE_COMMIT_MSG && git push`。pre-commit は eslint 警告0が条件。
- 変更前に tsc、画面変更は本番/ローカルで実画面確認。`select("*")` 禁止。
- ロールバック基点: git タグ `stable-2026-10-02`（リファクタ前）、Vercel Instant Rollback。

## 関連ドキュメント

- 引き渡し・運用の説明: Claude Docs「ROBUST 依頼書対応・引き渡し」ドキュメント
- `docs/ROBUST_DRIVE_AUTO_SETUP.md`（Drive連携）、`ROBUST_確認手順_郵便番号自動入力.md`
- 全体ルール: `CLAUDE.md`

## 直近の変更履歴（要約）

- 2026-10: 登録時の決済エラー対策、生年月日の入力検証と日本語エラー、QRのローカル生成、リージョン hnd1 固定と API 並列化、管理画面/登録画面の部品分割（cfbac45）

# ROBUST 動画 Drive 権限 自動化 セットアップ手順

会員の「動画ON/OFF・退会・休会」に連動して、Google Drive フォルダの閲覧権限を
**自動で付与/削除**する仕組みのセットアップ手順です。これにより手動共有の
「退会者の権限を外し忘れて動画を見続けられる」事故をゼロにできます。

> 実装: `lib/robust/drive.ts`（サービスアカウントの JWT を自前署名 → Drive REST API）。
> 追加 npm 依存はありません。`app/api/gym/robust/members` の権限/ステータス変更時に自動実行されます。
> env が未設定の間は no-op（自動化オフ）で、管理画面の「📹 動画アクセス（Drive共有管理）」
> リストを見ながらの手動運用にそのままフォールバックします。

## 必要なもの
- 動画を入れる Google Drive フォルダ
- Google Cloud のサービスアカウント（無料）

## 手順

### 1. Google Cloud でサービスアカウントを作成
1. https://console.cloud.google.com/ でプロジェクトを作成（既存でも可）
2. 「APIとサービス」→「ライブラリ」→ **Google Drive API** を有効化
3. 「APIとサービス」→「認証情報」→「認証情報を作成」→ **サービスアカウント**
4. 作成後、そのサービスアカウントの「キー」→「鍵を追加」→ **JSON** をダウンロード
   - JSON 内の `client_email`（`xxx@xxx.iam.gserviceaccount.com`）を控える

### 2. Drive フォルダをサービスアカウントに共有
1. 動画フォルダを開く →「共有」
2. 手順1で控えた `client_email` を **「編集者」** で追加
   - ※ 編集者でないと、サービスアカウントが他者へ権限付与/削除できません
3. フォルダ URL の `folders/` の後ろが **フォルダ ID** です
   - 例: `https://drive.google.com/drive/folders/`**`1AbCdEf...`** ← この部分

### 3. Vercel に環境変数を設定（Toshiki さん作業）
Vercel → bjj-app → Settings → Environment Variables に以下を追加:

| 変数名 | 値 |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | ダウンロードした JSON ファイルの**中身を丸ごと貼り付け** |
| `ROBUST_DRIVE_FOLDER_ID` | 手順2のフォルダ ID |

> 🔒 これらは秘密情報です。**Claude には貼らず、ご自身で Vercel に設定**してください。
> 設定後に再デプロイすると自動化が有効になります。

### 4. 動作
- 会員管理で **🎬 動画ON** → その会員の Google アカウントをフォルダ閲覧者に自動追加
- **🎬 動画OFF / 退会 / 休会** → フォルダ閲覧者から自動削除
- 共有先メールは `google_email` 列（未設定ならログイン用 `email`）

## 補足
- 会員のログイン email が Google アカウントでない場合は、管理画面で `google_email` を
  別途設定できるようにする拡張が可能（必要になったら実装します）。
- 自動化が有効でも、管理画面の「📹 動画アクセス（Drive共有管理）」リストは
  現状把握・突合用として引き続き表示されます。
- 失敗時（ネットワーク/権限不足）は DB 更新は止めず、Sentry に
  `robust.drive.sync_failed` として記録されるので後追いできます。

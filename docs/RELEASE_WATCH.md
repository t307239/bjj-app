# Anthropic リリース監視ログ

---

## 2026/04/20 チェック

### 新着リリース

#### 🧠 新モデル
- **Claude Opus 4.7**（2026/04/16）: Opus 4.6の後継。ソフトウェアエンジニアリングと長時間タスクで大幅改善。API: `claude-opus-4-7`。価格据置（$5/$25 per MTok）
  - **高解像度ビジョン**: 画像最大2,576px / 3.75MP（従来1,568px / 1.15MPの3倍超）
  - **`xhigh` effortレベル追加**: 推論深度の細かい制御が可能に
  - **⚠️ 破壊的変更あり**: トークナイザー更新（同じ入力で1.0〜1.35倍のトークン消費）、指示のリテラル解釈が強化されプロンプト調整が必要な場合あり
  - ドキュメント推論エラー4.6比21%減、金融エージェント評価でSOTA
- **Claude Opus 4 / Sonnet 4 非推奨化**（4/14公式発表）: `claude-opus-4-20250514` → 4.7、`claude-sonnet-4-20250514` → 4.6へ移行推奨。retire 2026/06/15

#### 🖥️ プロダクト
- **Claude Design**（2026/04/17）: Anthropic Labs新製品。デザイン・プロトタイプ・スライド・ワンページャーなど視覚的出力の生成ツール
- **Claude Opus 4.7がBedrock全顧客に開放**: 27 AWSリージョン、セルフサーブで利用可能

### 💡 BJJ Appへの影響
- **Opus 4.7移行検討**: 現在Sonnet 4.6使用のため即座の影響なし。ただしWiki生成バッチやQAスコアリングでOpus品質が必要な場合、4.7が候補
- **高解像度ビジョン**: テクニック動画サムネイル分析やUI検証の精度向上に活用余地
- **トークナイザー変更注意**: Opus系に切替える場合、トークン消費量が最大35%増加する可能性。コスト試算必須
- **Claude Design**: LP/マーケティング素材のプロトタイプ作成に活用可能

---

## 2026/04/16 チェック

### 新着リリース

#### 🧠 新モデル / 非推奨化
- **Claude Haiku 3 retire 2026/04/19 迫る** — 3日後に停止。Haiku 4.5 (`claude-haiku-4-5-20251001`) へ移行必須
- **Claude Sonnet 4 / Opus 4 retire 2026/06/15** — 4.6系へ移行予定（bjj-appは既に4.6のため影響なし）

#### 🛠️ Claude Code（v2.1.69 → 2.1.101, 4月）
- **Routines 機能**（4/11）: 繰り返し実行タスクをClaude Codeで定義可能。Mac offline時も動作
- **プロンプトキャッシュ強化**: `ENABLE_PROMPT_CACHING_1H` 環境変数で1時間TTL（API Key / Bedrock / Vertex / Foundry対応）
- **`/recap` コマンド** + セッション再開時のrecap（`/config`で自動化可）
- **Skill tool → 組込slash commands**: `/init` / `/review` / `/security-review` をモデルが自動発見・実行可能に
- **`/model` 切替警告**: モデル切替で次応答がhistory再読込（uncached）される旨を明示
- エラーメッセージ改善: rate limit種別区別、5xx/529でstatus.claude.comリンク、未知コマンドで類似候補提示

#### 📡 API変更
- **Advisor tool**（public beta）: 高速executorモデル + 高知能advisorモデルのペア実行。生成中の戦略ガイダンス提供
- Managed Agents / ant CLI / web search GA / 動的フィルタリング は前回（4/13）報告済み

#### 🖥️ プロダクト
- **Computer Use on Pro/Max**: Pro/Maxプランでも有効化。画面操作・dev tools実行可能に
- **Claude Cowork GA (macOS/Windows)**: Claude Desktop経由で一般提供開始
- **Analytics API** が Cowork 対応

### 💡 BJJ Appへの影響
- **⚠️ Haiku 3 棚卸し**: 4/19 retire。bjj-appでHaiku 3を直接呼ぶ箇所があれば今週中に置換（要grep）
- **1時間プロンプトキャッシュ**: Wiki動画/FAQ注入のGitHub Actionsバッチに `ENABLE_PROMPT_CACHING_1H=1` を追加すれば大幅コスト削減可能性
- **Advisor tool**: Wiki品質スコアリングや記録レビュー機能に応用余地
- **Routines (Claude Code)**: 現在の `net.bjj-app.autopush` デーモン + cron構成の一部を置換可能
- **現行モデル (Sonnet 4.6) は継続利用OK**

---

## 2026/04/13 チェック

### 新着リリース

#### 🧠 新モデル
- **Claude Mythos Preview**（2026/04/07）: 汎用モデルとして公開。コンピュータセキュリティタスクで突出した性能。Project Glasswing（防御的サイバーセキュリティ用）として招待制の研究プレビュー提供中。API文字列未公開（招待制）
- **Claude Opus 4.6**（2026/02/05）: コーディング・エージェント・エンタープライズワークフロー向け最上位モデル。API: `claude-opus-4-6`
- **Claude Sonnet 4.6**（2026/02/17）: 速度と性能を両立したバランス型。エージェント検索性能向上・トークン消費削減。1Mトークンコンテキスト（beta）。API: `claude-sonnet-4-6`

#### 🛠️ Claude Code
- `/team-onboarding` コマンド追加（チームメンバー向けオンボーディングガイド生成）
- `/ultraplan` コマンド追加（自動環境作成付き）
- Linuxでのサブプロセスサンドボックス（PID名前空間分離）追加
- gitワークツリーのステータスライン対応
- コマンドインジェクション脆弱性修正・長時間セッションでのメモリリーク修正
- Homebrewインストールアップデート通知、ctrl+e動作修正

#### 📡 API変更
- **Claude Managed Agents**（公開beta）: ベータヘッダー `managed-agents-2026-04-01` 必須。セキュアサンドボックス付き自律エージェントハーネス。サーバー送信イベントストリーミング対応
- **ant CLI** 新登場: Claude API 用コマンドラインクライアント。Claude Codeとのネイティブ統合、YAMLでAPIリソースのバージョン管理
- **データレジデンシーコントロール**: `inference_geo` パラメータで推論リージョン指定可能。US限定推論は2026/02/01以降モデルで1.1倍価格
- **Message Batches API**: Opus 4.6/Sonnet 4.6 で `max_tokens` 上限を300kに拡張
- **Webサーチ・プログラマティックツール呼び出し**: betaヘッダー不要でGA（一般提供）
- **動的フィルタリング**: Web検索・Webフェッチでコード実行による事前フィルタリング対応、コンテキスト節約
- **コード実行**: Webサーチ/Webフェッチ併用時は無料

#### 🖥️ プロダクト
- **Vercept買収**（2026/02）: Claude のコンピュータユース能力強化へ
- **Claude 新コンスティテューション**: Claude の振る舞いの原則を更新・公開

### 💡 BJJ Appへの影響
- **Managed Agents**: 将来の自動化（ランキング更新・Wiki生成）をサーバーサイドエージェントに移行する際に活用検討
- **Message Batches 300k tokens**: Wiki大量生成バッチの出力上限撤廃。長文ページ生成が安定化
- **Webサーチ GA**: betaヘッダー削除可能。既存コードの `anthropic-beta: web-search-*` ヘッダーがあれば除去推奨
- **Claude Sonnet 4.6（現在使用中）**: 今回の確認で現行モデルが最新世代であることを確認済み

---

*（このファイルはAnthropicリリース自動監視スクリプトにより管理）*

# Anthropic リリース監視ログ

---

## 2026/05/04 チェック

### 新着リリース

#### 🛠️ Claude Code v2.1.126（2026/05/01）
- **`/model` ピッカー gateway 対応**: `ANTHROPIC_BASE_URL` が Anthropic互換gatewayの場合、gatewayの `/v1/models` エンドポイントからモデル一覧を取得して表示
- **`claude project purge [path]` コマンド追加**: プロジェクトのClaude Code状態（transcript、tasks、file history、config）を一括削除。`--dry-run` / `-y/--yes` / `-i/--interactive` / `--all` フラグ対応
- **OAuth ターミナル貼り付け対応**: ブラウザコールバックがlocalhostに到達できない環境（WSL2、SSH、コンテナ）でも `claude auth login` 時にOAuthコードをターミナルに貼り付けて認証可能
- **Mac sleep 復帰時のセッション安定化**: 長時間モデル思考中の "Stream idle timeout" 誤検知を修正、画像が2000px以上で session 壊れる問題も修正
- **セキュリティ修正**: `allowManagedDomainsOnly` / `allowManagedReadPathsOnly` が高優先度managed-settings sourceに `sandbox` blockがない場合に無視される問題を修正
- **Windows改善**: PowerShell 7をMicrosoft Store/MSI/.NET global tool経由でも検出、PowerShell有効時のprimary shell切替、日本語/韓国語/中国語のno-flicker mode文字化け修正
- **Read tool マルウェア偽陽性削除**: 旧モデルでの誤refusalや「これはマルウェアではない」コメントが出る問題を解消

#### 🛠️ Claude Code v2.1.121-123（2026/04/24-30）
- **`/resume` PR URL対応**: GitHub/GitHub Enterprise/GitLab/Bitbucket のPR URLを `/resume` 検索ボックスに貼ると、そのPRを作ったセッションを発見
- **MCP `alwaysLoad` オプション**: trueにするとそのMCP serverの全ツールがtool-search deferralをスキップ、常時利用可能に
- **`claude plugin prune` 追加**: 孤立したauto-installed plugin依存を削除、`plugin uninstall --prune` でカスケード削除
- **`/skills` 検索ボックス**: スキルが多くてもtype-to-filterで絞り込み可能
- **`PostToolUse` hooks 拡張**: `hookSpecificOutput.updatedToolOutput` で全ツールの出力をhookで置換可能（従来MCPのみ）
- **メモリリーク多数修正**: `/usage`の~2GBリーク、画像処理時のmulti-GB RSS、long-running tools失敗時のリークなどを修正
- **`ANTHROPIC_BEDROCK_SERVICE_TIER`環境変数追加**: Bedrock service tier (`default`/`flex`/`priority`) を選択可能

#### 🛠️ Claude Code v2.1.119-120 後遺症（2026/04/24）
- v2.1.119/v2.1.120 は8件のregression発生 → v2.1.117へpin推奨だった
- `claude --resume` がTypeErrorで停止、explicit指定 `claude-opus-4-7`（200k）が `claude-opus-4-7[1m]`（1M）に silent ルーティングされる課金/cache問題
- v2.1.121以降で順次修正済み

#### 🖥️ プロダクト
- **Claude for Creative Work**（2026/05）: クリエイティブツールとの公式MCP connectorを大量リリース
  - **Ableton Live/Push**: 公式ドキュメントでClaudeの回答を補強
  - **Blender**: Blender開発者によるMCP connector公式採用、3Dシーン解析・debug・batch script生成
  - **Affinity by Canva**: バッチ画像調整、レイヤー名変更、ファイルエクスポート等の自動化
  - **Autodesk Fusion**: Fusion subscriptionで3Dモデルを会話で生成・修正
  - **Resolume Arena/Avenue/Wire**: VJ・ライブビジュアル制御
  - **SketchUp**: 部屋・家具・サイトを会話で記述→3Dモデル化
  - **Splice**: 音楽サンプル検索
- **Anthropic Labs拡張**: Mike Krieger（Instagram共同創業者・現AnthropicのCPO）がBen Mannと組んでLabsで実験的プロダクト構築

#### 📡 API変更
- **Memory for Claude Managed Agents**（public beta）: 標準の `managed-agents-2026-04-01` betaヘッダーで利用可能に

### 💡 BJJ Appへの影響
- **`claude project purge`**: 古いプロジェクトのClaude Code状態を整理する場合に活用可能（bjj-app/wiki両方の `.claude/` 整理）
- **`/resume` PR URL対応**: PR作業の再開時、PR URLを貼るだけで該当セッションに復帰できる。レビュー往復が多いタスクで便利
- **`alwaysLoad` MCP**: Supabase MCPなど頻繁に使うサーバーに `alwaysLoad: true` を設定すれば、tool-search deferralを回避してレスポンス向上
- **メモリリーク修正**: 長時間実行する Wiki生成バッチで `/usage` 等を頻繁に開く運用なら、v2.1.121+へ更新推奨
- **Claude for Creative Work**: BJJ Wiki の動画サムネイル生成やマーケ素材制作で、Blender/Affinity 連携の活用余地あり（ただし優先度は低い）
- **v2.1.119/v2.1.120のregression**: もしv2.1.118から急いで上げていないなら、v2.1.121+を直接インストールが安全

---

## 2026/04/23 チェック

### 新着リリース

#### 🛠️ Claude Code v2.1.118（2026/04/23）
- **Vimビジュアルモード対応**: `v`/`V`でビジュアル選択・オペレータ操作可能に
- **カスタムテーマ機能**: `/theme`からテーマ作成・切替。`~/.claude/themes/`でJSON手動編集も可。プラグインもテーマ同梱可能
- **`/cost`+`/stats`→`/usage`に統合**: 両コマンドはショートカットとして残存
- **Hooks MCP直接呼び出し**: `type: "mcp_tool"`でHooksからMCPツール直接実行可能
- **Auto Mode改善**: `"$defaults"`キーワードでビルトインルール+カスタムルール共存。「Don't ask again」オプション追加
- **プラグイン改善**: `claude plugin tag`でリリースタグ作成、依存バージョン制約のスキップ通知が`/doctor`に表示
- **`--continue`/`--resume`改善**: `/add-dir`で追加したディレクトリのセッション検出対応
- **MCP OAuth修正多数**: `headersHelper`認証メニュー表示修正、トークンリフレッシュ競合修正、Keychain競合修正等
- **`/fork`最適化**: 親会話全書き込みからポインタ方式に変更（ディスク節約）

#### 🛠️ Claude Code v2.1.117（2026/04/22）
- forked subagents外部ビルド対応、モデル選択永続化改善、ローカル+claude.ai MCP同時設定時の起動高速化

#### 🛠️ Claude Code v2.1.116（2026/04/20）
- **`/resume`大幅高速化**: 40MB+セッションで最大67%高速化。dead-fork処理改善
- **思考スピナー改善**: インライン進捗表示（「still thinking」→「almost done thinking」）
- **セキュリティ**: sandbox auto-allowが`/`や`$HOME`への`rm`/`rmdir`をバイパスしないよう修正
- **VS Code/Cursor/Windsurf**: フルスクリーンスクロール改善、スクロール感度設定対応
- Devanagari等Indicスクリプトのターミナル表示修正、API 400エラーのキャッシュTTL順序修正

#### 📡 API変更
- **Claude Haiku 3 正式リタイア**（2026/04/20）: `claude-3-haiku-20240307`へのリクエストはエラーを返す。Haiku 4.5への移行必須

### 💡 BJJ Appへの影響
- **Hooks MCP直接呼び出し（v2.1.118）**: Wiki生成やQAフローでMCPツールをHooksから直接呼び出せるようになり、自動化パイプラインの柔軟性が向上
- **`/resume`高速化（v2.1.116）**: 長時間セッションの再開が大幅に速くなり、開発DX向上
- **Haiku 3リタイア確認済み**: bjj-appは既にHaiku 4.5使用のため影響なし

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

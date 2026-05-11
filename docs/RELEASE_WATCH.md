# Anthropic リリース監視ログ

---

## 2026/05/11 チェック

### 新着リリース

#### 🛠️ Claude Code v2.1.133（2026/05/10頃）
- **`v2.1.110` の non-streaming fallback retry cap を revert**: 一部 gateway / proxy で fallback retry が過度に制限されていた問題を解消
- **iTerm2 + tmux のターミナル表示乱れ修正**: terminal notifications 送信時にランダム文字 / input drift が発生する問題を fix
- **`@` ファイル候補が non-git ディレクトリで毎ターン re-scan される bug 修正**: 大規模 non-git directory での tab レスポンス改善
- **LSP diagnostics が edit 後に遅延表示される問題を修正**
- **`/resume` tab-completion が誤って auto-resume してしまう bug 修正**
- **`/context` の空行 rendering / `/clear` が `/rename` 名を落とす bug 修正**

#### 🛠️ Claude Code v2.1.132（2026/05/09頃）
- **🔒 stdio MCP メモリリーク修正**: 長時間セッションで RSS が 10GB 超まで膨張する問題を解消（バッチ作業者必読）
- **session-aware Bash 環境変数追加**: 各セッション固有のコンテキストが Bash tool に渡される
- **alternate screen mode の terminal escape hatch 追加**: full-screen TUI app との互換性向上

#### 🛠️ Claude Code v2.1.131（2026/05/08頃）
- システムプロンプト変更なし（内部 fix のみ）

#### 🛠️ Claude Code v2.1.130（2026/05/07頃）
- **マウスホイールスクロール速度 fix**: Cursor / VS Code 1.92–1.104 で xterm.js upstream bug により異常に速かった問題を解消
- **`/usage` Ctrl+S ハング修正**: Linux/X11 で stats screenshot を clipboard コピー時にハングする問題を fix
- **`/terminal-setup` の Windows Terminal 矛盾エラー修正**
- **`/effort` picker が `CLAUDE_CODE_EFFORT_LEVEL` env 上書きを反映しない bug 修正**
- **`/status` が一部ユーザーで誤った default model を表示する bug 修正**
- **Claude.ai connectors の deduplication**: 同一 upstream URL の connector が重複表示されていた問題を解消
- **Vertex AI**: X.509 cert ベースの Workload Identity Federation (mTLS ADC) サポート

#### 📡 API変更

##### **Claude Managed Agents 4 大新機能**（2026/05/06）— public beta
- **🌙 Dreaming（research preview）**: 過去セッションをレビューし pattern を抽出して agent を self-improve する自己改善メモリ機能。長期運用で agent の output 品質が継続向上
- **🎯 Outcomes（public beta）**: agent の最終 deliverable を構造化して取得できる。「何を作ったか」を programmatic に取り出せる
- **🤖 Multiagent orchestration（public beta）**: lead agent がジョブを分割し、specialist sub-agent に委譲する仕組み。各 sub-agent は独自の model / prompt / tools を持てる
- **📨 Webhooks（GA）**: session / vault lifecycle event を HTTPS endpoint に push。長時間ジョブの完了通知を polling 不要で受信可能。Console で endpoint 登録 + signing secret 自動生成
- **beta header**: `managed-agents-2026-04-01`（既存）

##### **ant CLI launch**（2026/05 中旬）
- Claude API 用の公式コマンドラインクライアント
- **Claude Code との native integration**: `ant` コマンドから直接 Claude Code セッション起動可能
- **YAML での API resource versioning**: prompt / agent / tool 定義を YAML で git 管理可能
- ターミナル中心の dev workflow を好む開発者向け

##### **Claude Haiku 3 廃止**（2026/05）
- `claude-3-haiku-20240307` への全 request が error 返却に
- 推奨移行先: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`)
- **影響**: Haiku 3 を使う旧 script があれば即時更新必須

##### **Claude in Amazon Bedrock がGA**（2026/05）
- 全 Bedrock 顧客に解禁（従来は申請制）
- Claude Opus 4.7 / Haiku 4.5 が Bedrock console から self-serve 利用可能
- **27 AWS region** で global / regional endpoint 提供
- Messages API endpoint: `/anthropic/v1/messages`

### 💡 BJJ Appへの影響

- **🔴 v2.1.132 stdio MCP メモリリーク修正は最優先で update 推奨**: BJJ Wiki の動画 batch / FAQ 注入 cron は 50-100 page 連続処理で MCP セッションが長時間化するため、10GB 級リークの影響直撃の可能性あり。`claude update` を実行
- **v2.1.133 `@` ファイル候補 re-scan 修正**: `~/Claude/bjj-wiki/en/` 等の数千 file directory での tab 補完レスポンスが改善（体感差が出る）
- **v2.1.130 `/usage` Ctrl+S ハング**: macOS では発症しないため bjj-app 開発に直接影響なし
- **🟢 Managed Agents Webhooks**: `bjj-app-inc.plugin` を Managed Agents 化する場合、Wiki batch 完了通知を Telegram bot 経由で受け取る現運用と統合余地あり。ただし優先度は低（現運用の cron + Telegram で十分）
- **🟢 Multiagent orchestration**: BJJ Wiki の翻訳 batch（EN→JA→PT）を lead+specialist 構成にすれば、各 locale 専用 agent で品質向上余地あり。ただし現状の Gemini 直接呼び出しで十分機能しており、移行コストは見合わない
- **🟡 ant CLI**: YAML での agent 定義版管理は便利だが、bjj-app は既に `.claude/skills/` `.claude/agents/` で管理しており移行不要
- **🔴 Haiku 3 廃止**: bjj-app / bjj-wiki で `claude-3-haiku-20240307` を直接呼び出している箇所がないか念のため確認推奨（grep ですぐ確認可能）
- **🟢 Bedrock GA**: AWS インフラ未使用のため影響なし

---

## 2026/05/07 チェック

### 新着リリース

#### 🛠️ Claude Code v2.1.129（2026/05/06）
- **`--plugin-url <url>` フラグ追加**: URLからplugin .zipアーカイブをfetchして現セッションで利用可能。プロトタイプ共有や一時的なツール導入が容易に
- **`CLAUDE_CODE_FORCE_SYNC_OUTPUT=1` 環境変数**: auto-detectionが見落とすターミナルでsynchronized outputを強制有効化
- **`CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE`**: Homebrew/WinGetインストール時、バックグラウンドでupgrade実行→再起動promptを表示
- **⚠️ Gateway `/v1/models` discovery がopt-inに変更**: v2.1.126〜v2.1.128では自動だったが `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` 必須に
- **Ctrl+R履歴検索のデフォルト変更**: 全プロジェクト横断検索（v2.1.124以前と同挙動）に戻る。現プロジェクト/セッション絞込はCtrl+S

#### 🛠️ Claude Code v2.1.128（2026/05/04）
- **`/color` 引数なしでランダム色**: セッションの色を毎回変えられる
- **`/mcp` 改善**: 接続中サーバーのツール数表示、tool 0件で接続したサーバーをflag表示
- **`--plugin-dir` が .zip 対応**: ディレクトリだけでなくzipアーカイブのpluginを直接読み込める
- **`--channels` がAPI key認証で動作**: console org（managed settings利用）は `channelsEnabled: true` 設定が必要
- **`/model` picker整理**: 重複Opus 4.7エントリを統合、現Opusは「Opus 4.7」ではなく「Opus」表示
- **🔒 サブプロセスがOTEL_*環境変数を継承しない**: Bash/hooks/MCP/LSPでOTEL-instrumented appsを呼んでもCLI自身のOTLP endpointを誤って使わない
- **⚠️ MCP予約名 `workspace` 追加**: 既存サーバーで同名のものはwarningと共にskipされる
- **MCP再接続時のtool list flood修正**: 再接続のたびにtool名フルリストでログを汚さず、サーバープレフィックスでサマリ表示

#### 🛠️ Claude Code v2.1.127（2026/05/02-04頃）
- **SDK / `claude -p` 改善**: `CLAUDE_CODE_FORK_SUBAGENT=1` がnon-interactiveでも動作、`--dangerously-skip-permissions` が `.claude/skills/` `.claude/agents/` `.claude/commands/` への書込でprompt不要に、`/terminal-setup` がiTerm2の "Applications in terminal may access clipboard" を有効化
- **MCP起動の自動リトライ**: 起動時の一時エラーで切断されるのではなく最大3回まで自動retry
- **🔒 Windows clipboardのコマンドライン露出修正**: コピー内容がprocess command-lineに見えてEDR/SIEM telemetryに漏れる問題を修正、PowerShell tool の bare `--` を `--%` stop-parsing tokenと誤判定する問題も修正

#### 🖥️ プロダクト

- **Financial Services Agent Templates**（2026/05/05）: 金融業務向け10種のagent template公開
  - 内容: pitchbook作成 / KYCファイル選別 / 月次決算（month-end close）等の時間消費型業務
  - 配布: Claude Cowork plugin / Claude Code plugin / Claude Managed Agentsのcookbookとして同時提供
  - **Microsoft 365 add-insも実用フェーズへ**: Excel / PowerPoint / Word add-insがGA、Outlookはcoming soon。各app間でcontextが自動継承される（Excelで作ったモデルをPowerPointに渡しても再説明不要）
  - 使い方例: Pitch agentにtarget listを渡すと、Excelでcomps model→PowerPointでpitchbook→Outlookでcover noteまで一気通貫
  - 全paid planで利用可能、Claude Platform（public beta）でも利用可能

#### 📡 API変更
- **特になし**（Opus 4.7 / Managed Agents / Memory beta はすでに4/13・4/20のチェックで報告済み）

### 💡 BJJ Appへの影響

- **v2.1.129 Gateway model discovery opt-in化**: Anthropic互換gatewayを使っていない場合は影響なし。bjj-appは公式API直接利用なので無関係
- **v2.1.128 MCP予約名 `workspace`**: bjj-appのMCP設定で `workspace` という名前のサーバーを使っていないか要確認（プロジェクト構成上未使用、影響なし）
- **v2.1.128 `--plugin-dir` zip対応**: `bjj-app-inc.plugin` をzip化して配布する場合に活用可能
- **v2.1.127 Windows clipboardセキュリティ修正**: bjj-app開発はmacOSのため直接影響なしだが、将来Windows環境を使う場合は注意
- **Microsoft 365 add-ins GA**: BJJ Wikiのマーケティング素材作成（PowerPointでの提案資料、ExcelでのKPI集計）に活用余地。ただし優先度低
- **Financial Services agent templates**: BJJ Appのドメインとは無関係。ただしagent template plugin形式は今後 `bjj-app-inc.plugin` の参考になる可能性

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

# Anthropic リリース監視ログ

## 2026/04/07 チェック

### 新着リリース（直近1週間）

- 📡 **Message Batches API max_tokens 上限拡張** (2026/03/30): Opus 4.6 / Sonnet 4.6 向けに300kトークン上限を解禁。ベータヘッダー `output-300k-2026-03-24` が必要
- 🏗️ **Google / Broadcom パートナーシップ** (2026/04/06): Anthropic が次世代コンピュート数ギガワット規模を確保。長期的なモデル提供安定化が期待される

### 直近の主要アップデート（参考：過去数週間）

- 🧠 **Claude Opus 4.6**: 最高性能モデル。1Mトークンコンテキスト GA。アダプティブ思考デフォルト化、prefilling廃止
- 🧠 **Claude Sonnet 4.6**: バランス型最新モデル。エージェント検索性能向上・トークン消費削減。1M ctx (beta)
- 📡 **1Mトークンコンテキスト GA** (2026/03/13): Opus 4.6 / Sonnet 4.6 で正式GA。メディア上限も100→600枚に拡張
- 📡 **Extended Thinking 表示制御** (2026/03/16): `thinking.display: "omitted"` でthinkingを省略しストリーミング高速化
- 📡 **Models API 拡張** (2026/03/18): `max_input_tokens`, `max_tokens`, `capabilities` フィールド追加
- 🛠️ **Claude Code**: `/powerup` 対話型チュートリアル追加。`/cost` でモデル別・キャッシュヒット別内訳表示。大容量ファイルのdiff計算60%高速化

### ⚠️ 近日中の非推奨・廃止

- **Claude Haiku 3**: 2026/04/19 廃止予定（残り12日）→ Haiku 4.5 への移行を推奨
- **1Mコンテキスト ベータヘッダー** (`context-1m-2025-08-07`): 2026/04/30 廃止予定。Sonnet 4.5/4 には不要になった

### 💡 BJJ App への影響

- **Haiku 3 廃止 (04/19)**: bjj-app で `claude-haiku-3` を使用している箇所があれば即 `claude-haiku-4-5-20251001` へ移行が必要
- **1Mコンテキスト ベータヘッダー廃止 (04/30)**: APIリクエストに `context-1m-2025-08-07` ヘッダーを付けていれば削除要（Sonnet 4.6 では不要）
- **Message Batches 300k**: Wikiバッチ生成など大量処理に活用可能

---
<!-- 以降は将来のエントリが追記されます -->

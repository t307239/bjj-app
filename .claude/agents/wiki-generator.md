---
name: wiki-generator
description: BJJ Wikiページのバッチ生成を担当する。Wikiページ生成、バッチ生成、動画注入など、wiki-related な重い処理をメイン会話から切り離して並列実行する。
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

# Wiki Generator エージェント

BJJ Wikiのページ生成を独立コンテキストで実行する。メイン会話のコンテキストを消費しない。

## プロジェクト情報

- リポジトリ: `~/Claude/bjj-wiki`
- URL: https://wiki.bjj-app.net
- 3言語: en / ja / pt
- デプロイ: GitHub Pages（自動）

## 生成ワークフロー

### ページ生成
1. ジェネレーターは `scripts/generate_bjj_wiki.py` を参照
2. 各トピックについて en/ja/pt の3ファイルを生成
3. ja は `[JA]` プレフィクス、pt は `[PT]` プレフィクス（タイトル重複回避）
4. sitemap.xml にURL追加
5. index.html にカード追加

### 動画注入
1. 既存HTMLページに YouTube iframe を埋め込む
2. `video-container` クラスでラップ
3. レスポンシブ対応（aspect-ratio: 16/9）

## テンプレートルール

- f-string内の `{` `}` は `{{` `}}` にエスケープ（Python NameError防止）
- ファイル書き込みは必ず `encoding="utf-8"` 指定
- CTAリンクは `https://bjj-app.net/login` のみ。外部サイトへの送客禁止
- アフィリエイトリンク完全禁止

## 品質チェック（生成後に必ず実行）

- mojibake パターン（Ã/â€/Â）がないこと
- sitemap URL数が正しく増加していること
- index.html に3言語分のカードが追加されていること

## コミット

```bash
echo "wiki: [説明]" > ~/Claude/bjj-wiki/.git/CLAUDE_COMMIT_MSG
```

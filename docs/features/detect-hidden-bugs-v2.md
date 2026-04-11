# detect_hidden_bugs.py v2 — 新カテゴリ追加 PRD

## 概要
今回のBottomSheet不可視バグ（CSS transform が position:fixed を壊す）と、ハードコード英語文字列の見逃し（"Optional details"）を受けて、detect_hidden_bugs.py に新しい検出カテゴリを追加する。

## 追加カテゴリ一覧

### カテゴリ 23: CSS_CONTAINING_BLOCK_FIXED
**検知内容**: CSS の @keyframes で `transform` / `filter` / `will-change: transform` / `perspective` を使用しており、そのアニメーションクラスが template.tsx / layout.tsx 等のページラッパーに適用されている場合、子孫の `position: fixed` が壊れるリスクを警告。

**検出ロジック**:
1. globals.css の @keyframes を解析し、containing block 生成プロパティ（transform, filter, will-change, perspective, backdrop-filter）を持つものを特定
2. template.tsx / layout.tsx でそのアニメーションクラスが使用されているか確認
3. components/ 内に `fixed` クラスを使うコンポーネントが存在するか確認
4. 1+2+3 が全て真なら CRITICAL で報告

### カテゴリ 24: JSX_HARDCODED_ENGLISH（強化版）
**検知内容**: JSX内の `>テキスト<` パターンで、3文字以上の英語テキストがi18n関数（t()）を通さず直接記述されている箇所。

**偽陽性除外**:
- BJJ専門用語（Layer 1）: Gi, No-Gi, BJJ, MMA, UFC, etc.
- ブランド名: BJJ App, Vercel, Supabase, etc.
- CSSクラス名やJSX属性値（className=内は除外）
- コメント行
- コード識別子（キャメルケース・スネークケース）

### カテゴリ 25: ANIMATION_PERF_RISK
**検知内容**: @keyframes 内で `width`, `height`, `top`, `left`, `margin`, `padding` をアニメーションしている箇所。GPU composite layer（transform/opacity）のみが推奨。

### カテゴリ 26: FORM_MISSING_PREVENT_DEFAULT
**検知内容**: `onSubmit={` を含むJSX要素のハンドラ内で `e.preventDefault()` が見つからない場合。フォーム送信時のページリロードを防止。

### カテゴリ 27: CONDITIONAL_HOOK_RISK
**検知内容**: 関数コンポーネント内で早期return（`if (...) return null/undefined/<JSX>`）の後に `useState` / `useEffect` / `useRef` / `useMemo` / `useCallback` が呼ばれている箇所。React Hooks の呼び出し順序規約違反。

### カテゴリ 28: INLINE_STYLE_OBJECT
**検知内容**: JSX内で `style={{` パターンを使用している箇所。Tailwindクラスで統一すべき（SVG属性を除外）。

## UI/UX
CLIツールなのでUI変更なし。出力フォーマットは既存と同一（severity + category + filepath + detail + fix_hint）。

## データフロー
ファイル読み込み → パターンマッチ → BugReport追加。新テーブル・API不要。

## コンポーネント設計
変更ファイル: `scripts/detect_hidden_bugs.py` のみ。
新規関数: check_containing_block_fixed(), check_jsx_hardcoded_english(), check_animation_perf(), check_form_prevent_default(), check_conditional_hooks(), check_inline_styles()

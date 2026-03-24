# BJJ App Inc. — Development Log Archive

---

- Day 5_03 (2026/03/24): **UX polish — CLS skeleton, i18n hardcoded strings, contrast fixes**
  - WeeklyStrip: `if (loading) return null` → pulse skeleton (height 88px) to prevent CLS (UX #23) ✅
  - WeeklyStrip: `text-gray-600` → `text-gray-500` on session counter (UX #24) ✅
  - TrainingLogList: hardcoded `"Collapse ▲"` / `"Show More ▼"` → `t("training.collapse")` / `t("training.showMore")` ✅
  - TrainingLogList: `text-gray-600` → `text-gray-500` on expand/collapse buttons (UX #24) ✅
  - InsightsBanner: dismiss button `text-gray-600` → `text-gray-400` (UX #24) ✅
  - `messages/en.json`: added `training.collapse` + `training.showMore` keys ✅
  - TypeScript: 0 エラー ✅

- Day4fo_99 (2026/03/24): **BACKLOG B-05〜B-07/B-09〜B-10 実装完了（全優先度1・2タスク完了）**
  - B-05: 強制Aha!モーメント — auth callback `?welcome=1` + TrainingLog `initialOpen` prop ✅
  - B-06: SNSシェアボタン — Canvas API で 9:16 Story 画像生成 + Web Share API / PNG DL fallback ✅
  - B-07: Skeleton Loaders — `components/ui/Skeleton.tsx` 新規 + TrainingChart/TrainingBarChart/PersonalBests 適用 ✅
  - B-09: Tag a Partner — `partner_username` フィールド + TrainingLogList 表示 + i18n ✅
  - B-10: Swipe Delete/Edit — `SwipeableCard.tsx` ネイティブタッチ実装（64px threshold）✅
  - Fix: `TrainingEntry` 型に `instructor_name?` + `partner_username?` 追加
  - TypeScript: 0 エラー ✅
  - バグスイープ結果: ✅ TOTAL ISSUES: 0
  - ⚠️ Supabase マイグレーション必要（B-09）:
    `ALTER TABLE training_logs ADD COLUMN partner_username TEXT DEFAULT NULL;`
  - 次の優先タスク:
    1. B-11〜B-15: 優先度3（条件付き — MAU/契約数による）
    2. B-20: Playwright E2E（ユーザーのMacで実行）
    3. B-21/B-22: ローンチ施策

- Day4fo_98 (2026/03/24): **BACKLOG B-01〜B-04/B-08/B-16〜B-19 実装完了**
  - docs/BACKLOG.md 新規作成（22項目 優先度付き実装案）✅
  - B-01: `TrainingLogForm.tsx` Gi/No-Gi 巨大トグル + 4型サブグリッド ✅
  - B-02: `BackToTop.tsx` 削除 + `dashboard/page.tsx` から除去 ✅
  - B-03: `InstallBanner.tsx` + `TrainingLog.tsx` PWA表示を3回目ログ保存後に遅延 ✅
  - B-04: `TrainingLogForm.tsx` インストラクタータグ入力フィールド追加 ✅
  - B-08: `ProUpgradeBanner.tsx` ダークUI + エメラルドCTA + PAYMENT_LINKガード ✅
  - B-16: `docs/UI_DESIGN.md` B2B/B2C カラー分離 + ドメインカラー保護ルール追記 ✅
  - B-17: `/terms` + `/privacy` TOC付き・max-w-3xl・emerald左ボーダーアクセント ✅
  - B-18: `scripts/check-links.mjs` 静的リンク監査スクリプト + `npm run check-links` ✅
  - B-19: `eslint.config.mjs` ESLint 9 flat config + jsx-a11y rules ✅
  - Fix: `TrainingLogForm.tsx` `instructor_name?: string` → `instructor_name: string`（TS strict）✅
  - TypeScript: 0 エラー ✅
  - バグスイープ結果: ✅ TOTAL ISSUES: 0
  - 次の優先タスク:
    1. B-05: 強制Aha!モーメント（profiles.has_logged_first + auth callback）
    2. B-06: Instagram Story Share（html2canvas）
    3. B-07: Skeleton Loaders全面適用

- Day4fo_97 (2026/03/24): **UX監査25項目 修正完了 — 全項目 ✅**
  - #11: `PersonalBests.tsx` シェアボタンに `isCopied` 2秒フィードバック追加 ✅
  - #11: `LogoutButton.tsx` ログアウト中 `isLoading` ステート追加（前セッション）✅
  - #2: `GymDashboard.tsx` / `BeltPromotionCelebration.tsx` モーダルに `max-h-[90vh] overflow-y-auto` 追加 ✅
  - #12: `PersonalBests.tsx` ログゼロ時の空ステートUI追加（null → 案内テキスト）✅
  - #18: `GymCurriculumCard.tsx` / `ProfileForm.tsx` gymName に `truncate` 追加 ✅
  - #23: `PersonalBests.tsx` / `TrainingChart.tsx` / `TrainingBarChart.tsx` ローディング中を `min-h` プレースホルダーに変更（CLS対策）✅
  - #24: `CollapsibleSection.tsx` / `ProStatusBanner.tsx` / `SkillMapPC.tsx` / `SkillMapMobile.tsx` `text-zinc-600` → `text-zinc-400`（コントラスト改善）✅
  - #3: `TrainingBarChart.tsx` `overflow-y-auto` コンテナに `scrollbar-hide` 追加 ✅
  - #13: `InstallBanner.tsx` インストール失敗時のエラートースト追加 ✅
  - #20: `TrainingLogList.tsx` / `TechniqueLogList.tsx` / `BeltProgressCard.tsx` / `TrainingLog.tsx` アイコンのみボタンに `aria-label` 追加 ✅
  - #10 フォーカスリング: `globals.css` `:focus-visible` → emerald #10B981（前セッション）✅
  - #14 削除ガード: `GuestDashboard.tsx` Undoトースト / `SkillMapPC.tsx` / `SkillMapMobile.tsx` インライン確認（前セッション）✅
  - TypeScript: 0 エラー ✅
  - バグスイープ結果: ✅ TOTAL ISSUES: 0

- Day4fo_96 (2026/03/24): **Cloudflare DNS 更新完了 — bjj-app.net A レコード化**
  - Vercel "Configure Automatically" → Cloudflare Domain Connect OAuth フロー実行
  - 旧: `CNAME bjj-app.net → cname.vercel-dns.com` 削除
  - 新: `A bjj-app.net → 216.198.79.1` + `TXT _vercel` 追加
  - Vercel Domains: "DNS Change Recommended" → **"Valid Configuration"** ✅

- Day4fo_95 (2026/03/24): **blue→emerald 横展開修正（6箇所）**
  - TrainingLogList: Load Moreボタン blue→emerald ✅ / editボタン hover blue→emerald ✅
  - InsightsBanner: consistencyMsg + wikiリンク blue→emerald ✅
  - GymDashboard: totalSessions統計値 blue→emerald ✅
  - PersonalBests: Sparklineグラフ stroke/fill blue→emerald (#10B981) ✅
  - TypeScript 0エラー ✅

- Day4fo_94 (2026/03/24): **UIバグ3件修正（ユーザー報告）**
  - NavBar Home タブの橙丸ドット (`trainedToday === false` 表示) を削除 — desktop + mobile両方 ✅
  - SkillMapPC 空ステート: `AddNodeInput`（`position:absolute zIndex:20`）がNavBar(z-50)の裏に隠れて入力不可になるバグを修正。専用インライン `EmptyStateAddForm` コンポーネントに置換 ✅
  - PersonalBests: アコーディオン展開時に「📊 Personal Records」ヘッダーが二重表示される問題を修正（内側のh4を削除） ✅
  - TypeScript 0エラー ✅

- Day4fo_93 (2026/03/24): **全プライマリボタン active:scale-95 タップフィードバック + ProfileForm emerald統一**
  - TechniqueLogList (Add / Save) / ProfileForm (Save) / GoalTrackerEditor (Save) / GymRegistrationForm (Create) / TechniqueLogForm (Save x2) / StreakFreeze (Use freeze) / GuestDashboard (Log / CTA) — 全9ボタンに `active:scale-95 transition-all` 追加 ✅
  - ProfileForm: CSV export button + totalMinutes stat を blue → emerald (#10B981) 統一 ✅
  - TypeScript 0エラー ✅

- Day4fo_92 (2026/03/24): **優先度高バックログ 3点実装**
  - Blurred paywall — `TrainingTypeChart` + `TrainingChart` に `isPro` prop 追加、非Proはblur + upgrade CTA ✅
  - B2B Nudge button — `MemberCard`（yellow/red リスクメンバー）に「Copy reminder」ボタン追加 ✅
  - Printable Leaderboard — GymDashboard Proオーナー向けに月次ランキング印刷機能追加 ✅
  - バグスイープ: ✅ TOTAL ISSUES: 0 / TypeScript 0エラー ✅

- Day4fo_91 (2026/03/24): **Dashboard UX 4点改善**
  - `GoalTracker` 隔離 — `hasFirstLog` falseの新規ユーザーに非表示 ✅
  - `StreakProtect`/`StreakFreeze` 条件強化 — `streak >= 1` → `streak >= 3` ✅
  - Recovery トレーニングタイプ追加 — `lib/trainingTypes.ts` + `messages/en.json` ✅
  - `TimeGreeting` 新規コンポーネント — 時間帯別グリーティング（morning/afternoon/evening/night） ✅
  - ベルト昇格コンフェッティ確認 — `BeltPromotionCelebration.tsx` + `ProfileForm.tsx` 実装済み ✅
  - バグスイープ: ✅ TOTAL ISSUES: 0 / TypeScript 0エラー ✅

- Day4fo_90 (2026/03/24): **Dashboard cleanup — ノイズコンポーネント6点削除**
  - `app/dashboard/page.tsx` — `ProStatusBanner` / `WeeklyPaceBanner` / `DailyRecommend` / `DailyWikiTip` / `WikiQuickLinks` / `TrainingCalendar` 削除 ✅
  - Section 3 を `gymCurriculum` 条件付きに変更（GymCurriculumCard のみ残存） ✅
  - 未使用変数 `daysLeftInWeek` / `subscriptionStatus` + 未使用import 6点 クリーンアップ ✅
  - TypeScript 0エラー確認 ✅

- Day4fo_89 (2026/03/24): **画面デバッグ — 2バグ修正**
  - `app/page.tsx` + `app/gym/page.tsx` — keycap絵文字（1️⃣2️⃣3️⃣）をCSS数字サークルに変更（フォント環境依存の二重表示バグ）✅
  - 全ページタイトルの `| BJJ App` 重複削除（layoutのtemplateと二重になっていた）: dashboard/login/profile/gym/techniques/terms/privacy/tokushoho/gym-dashboard/join-gym ✅
  - コンソールエラースキャン: Immersive Translate拡張の偽陽性のみ（実コードバグなし）✅
  - TypeScript 0エラー確認 ✅

- Day4fo_88 (2026/03/24): **Consultant Review実装 — UX/マイクロコピー全実装**
  - #6: `app/page.tsx` — 全CTAを「Step on the Mat」に統一（micro copy sweep）✅
  - #4: `components/TrainingChart.tsx` — 空状態テザー実装（ぼかしダミーヒートマップ + CTA overlay）✅
    - `onLogRoll` prop追加 / `messages/en.json` + `messages/ja.json` に chart.empty* キー追加
    - `app/dashboard/page.tsx` — `onLogRoll` を `window.scrollTo({ top: 0 })` でワイヤリング
  - #7: `components/FirstRollCelebration.tsx` （新規作成）— canvas confetti + welcome modal ✅
    - `components/TrainingLog.tsx` — `totalCount === 0` の初回save後に `showCelebration` トリガー
    - `messages/en.json` に `onboarding.firstRoll*` キー追加
  - バグスイープ結果: ✅ TOTAL ISSUES: 0（TypeScript 0エラー、banned CSS 0件）
  - 次の優先タスク:
    1. #3: B2B Gym "Nudge" button for at-risk members
    2. #5: Wiki TL;DR summary cards (bjj-wiki project)
    3. git push（Day4fo_24〜88）

---

- Day4fo_87 (2026/03/24): **heatmap曜日整列 (#71) + ICU plural修正 (#4) + banned CSS撲滅**
  - `components/TrainingChart.tsx` — GitHub-style Sunday-aligned null-padding (#71) ✅
  - `messages/en.json` — streak.protect1 / gym.atChurnRisk1 追加（ICU plural → 条件分岐） ✅
  - `components/StreakProtect.tsx` — urgencyText を streak===1 ? t("streak.protect1") に ✅
  - `components/GymDashboard.tsx` — riskCount===1 条件分岐 ✅
  - `components/TrainingTypeChart.tsx` / `TrainingBarChart.tsx` — hover:text-gray-200 → hover:text-white ✅
  - `components/TrainingLogForm.tsx` — type select → large tappable tile grid (#2) ✅
  - `components/TechniqueLogForm.tsx` — bulk save button bg-violet-600 → #10B981 (#1) ✅
  - `app/page.tsx` — English CTA bg-blue-600 → #10B981, micro copy "Step on the Mat" (#1/#6) ✅
  - バグスイープ結果: ✅ TOTAL ISSUES: 0

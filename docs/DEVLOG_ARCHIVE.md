# BJJ App Inc. — Development Log Archive

---

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

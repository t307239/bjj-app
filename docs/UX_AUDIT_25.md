# BJJ App — グローバルUX監査レポート（25項目）

> 実施日: 2026/03/24
> 対象: `app/` + `components/` 全ファイル
> 判定: 🔴 即修正 / 🟠 高優先 / 🟡 中優先 / 🟢 低優先 / ✅ 問題なし

---

## カテゴリ1：レイアウトとスクロール

### #1 無限縦伸びリスト 🟡
**該当**: `TrainingLog.tsx`, `TechniqueLog.tsx`

「Load More」方式でデータを追記するため、記録数が多いユーザーではページが非常に長くなる。`max-h` 制限なし。現状の機能設計では意図的だが、30件超でUXが劣化し始める。

**対処案**: Load More → ページネーション切り替えをPhase後期に検討。

---

### #2 画面外ハミ出しモーダル 🟠
**該当**: `GymDashboard.tsx:619`（kick確認モーダル）, `BeltPromotionCelebration.tsx`

モーダルのコンテンツが長くなった際に `overflow-y-auto` + `max-h` の指定なし。スマホ縦持ちで画面下部が切れると閉じるボタンに触れられない。

```tsx
// 修正案: モーダル内コンテンツラップに追加
className="... max-h-[90vh] overflow-y-auto"
```

---

### #3 野暮ったいスクロールバー 🟢
**該当**: `TrainingBarChart.tsx`

`overflow-auto` はあるが `scrollbar-hide` クラスなし。Windowsブラウザで太いスクロールバーが出現する。

```tsx
// 修正: className に scrollbar-hide を追加
```

---

### #4 超ワイドモニターでの崩壊 ✅
全ページに `max-w-4xl mx-auto` が適切に設定済み。問題なし。

---

### #5 固定ヘッダーの下敷き ✅
NavBar は `sticky top-0 z-50`、コンテンツは `pb-20 sm:pb-0` で適切に余白確保済み。問題なし。

---

## カテゴリ2：モバイルとインタラクション

### #6 ファットフィンガー 🟠
**該当**: `TechniqueLogList.tsx:442,480`（edit/deleteボタン `p-1` + `w-4 h-4` SVG = 実タップ面積 ~24px）

Apple HIG推奨は44px、Android推奨は48px。現状は約24pxで誤タップ率が高い。

```tsx
// 修正案: p-1 → p-2 に変更
className="... p-2"
// または padding付きラッパーに変更
```

**該当**: `TrainingLog.tsx:487`（ログ削除ボタン `p-1`）も同様。

---

### #7 Hover限定アクション 🟠
**該当**: `AffiliateSection.tsx:132`

```tsx
<div className="text-orange-400 text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
```

タッチデバイスでは hover イベントが発火しないため、このテキストが永遠に非表示になる。

**修正案**: `opacity-0 group-hover:opacity-100` → 常時表示、またはタップで表示するインタラクションに変更。

---

### #8 Z-Indexの反乱 ✅
`z-50`（NavBar/Toast/モーダル）/ `z-40` / `z-20` / `z-10` で整理されており、`z-[60]` (confetti) もモーダル上に正しく配置。問題なし。

---

### #9 疑似ボタン ✅
`<div onClick>` や `<span onClick>` は全ファイルで未使用。すべて `<button>` タグ使用。問題なし。

---

### #10 迷子のフォーカス 🔴
**該当**: 下記30+コンポーネントに `focus:ring` / `focus-visible:ring` が未設定

`NavBar.tsx`, `PersonalBests.tsx`, `AffiliateSection.tsx`, `TrainingChart.tsx`,
`TrainingTypeChart.tsx`, `GoalTracker.tsx`, `TrainingBarChart.tsx`, `StreakFreeze.tsx`,
`LogoutButton.tsx`, `CollapsibleSection.tsx`, `DailyRecommend.tsx`, `TrainingCalendar.tsx`,
`InstallBanner.tsx`, `FirstRollCelebration.tsx`, `CsvExport.tsx`, `WikiQuickLinks.tsx`,
`ProfileTabs.tsx`, `GymCurriculumCard.tsx`, `DailyWikiTip.tsx`, `GymKickBanner.tsx`,
`GymRanking.tsx`, `InsightsBanner.tsx`, `StreakProtect.tsx`, `CompetitionStats.tsx`,
`GoalTrackerEditor.tsx`, `OnboardingChecklist.tsx`, `Toast.tsx`, `BeltPromotionCelebration.tsx`,
`AchievementBadge.tsx`

Tabキーナビゲーション時にフォーカス位置が不可視になる。WCAG 2.1 AA違反レベル。

**修正案（グローバル対応）**: `tailwind.config.js` で全ボタンに `focus-visible:ring-2 focus-visible:ring-[#10B981]/60` をデフォルト適用、またはベーススタイルに追加。

---

## カテゴリ3：フィードバックと状態

### #11 沈黙の非同期処理 🟠
**該当1**: `LogoutButton.tsx` — `handleLogout` 実行中にローディング状態なし。ネットワーク遅延時にユーザーが連打する可能性がある。

```tsx
// 現在
const handleLogout = async () => {
  await supabase.auth.signOut();
  ...
};

// 修正案: isLoading state を追加
const [isLoading, setIsLoading] = useState(false);
```

**該当2**: `PersonalBests.tsx:269`（Share/Copy ボタン）— クリックフィードバックがない。

---

### #12 絶望的なEmpty State 🟡
**該当**: `PersonalBests.tsx:34` — `data.length === 0` のとき `return null`（コンポーネント自体が消える）。

ユーザーは「Personal Records セクション自体が存在しない」と勘違いするリスクがある。初回ユーザーへの説明メッセージが必要。

```tsx
// 修正案: null ではなく空状態UIを返す
if (data.length === 0) return (
  <div className="text-center py-8 text-gray-500 text-sm">
    {t("stats.noBests")}
  </div>
);
```

---

### #13 沈黙のエラー 🟢
**該当**: `InstallBanner.tsx` — `catch` ブロックで `console.error` のみ、ユーザーへの通知なし。

PWAインストール失敗時にサイレント失敗する。`InstallBanner` は軽微な機能なので優先度は低い。

---

### #14 危険操作のノーガード 🔴
**該当1**: `GuestDashboard.tsx:225`

```tsx
onClick={() => handleDelete(log.id)}  // 確認なしで即削除
```

ゲストログは LocalStorage に保存されているため、誤タップで永久削除になる。undo機能もない。

**該当2**: `SkillMapPC.tsx:723` — `deleteNode` が `isPro` チェックのみで即削除。確認なし（ノードを削除すると接続エッジもすべて消える）。`SkillMapMobile.tsx:529` も同様。

**修正案**: TrainingLog と同様のトースト + Undo パターン、またはインライン confirm を実装。

---

### #15 現在地の喪失 ✅
`NavBar.tsx` で `pathname === item.href` 比較 + `aria-current="page"` が正しく実装済み。問題なし。

---

## カテゴリ4：フォームと入力

### #16 不適切なキーボード ✅
`TrainingLogForm.tsx` の数値フィールド（回数、時間）は `type="number"` が設定済み。問題なし。

---

### #17 遅すぎるバリデーション 🟢
`TrainingLogForm.tsx`, `TechniqueLogForm.tsx` にリアルタイムバリデーションなし。ただしフォームがシンプル（フィールド数が少ない）なので、現段階では Submit 後エラー表示で許容範囲内。

---

### #18 長文レイアウト崩壊 🟡
**該当**: `GymCurriculumCard.tsx:98`

```tsx
{gymName ? `From ${gymName}` : t("gym.curriculumFromGym")}
```

`gymName` が長い場合（例: "Brazilian Jiu-Jitsu Academy of Tokyo"）にカードが横に崩れる可能性。`truncate` クラスなし。

**該当**: `ProfileForm.tsx:158` の `gymName` 表示も同様。

---

### #19 検索の暴走 ✅
`TechniqueLog.tsx` と `TrainingLog.tsx` の検索はクライアントサイドフィルタリング（`useMemo`/配列フィルタ）。API は叩いていないため Debounce 不要。問題なし。

---

### #20 意味不明なアイコン 🟡
全体では `aria-label` が62箇所に設定されているが、`<button>` は166個ある。差分の約100ボタンは `aria-label` または `title` のどちらかを頼りにしている。

`title` 属性は存在するもの（`TechniqueLogList.tsx:481` など）は問題ないが、`TechniqueLogList.tsx:442`（editボタン）は `title` のみで `aria-label` なし。スクリーンリーダー対応として `aria-label` の明示的な設定を推奨。

---

## カテゴリ5：SaaSポリッシュとエッジケース

### #21 日本語のハードコード 🟢
**実際の違反件数: 3件**（401件中、コメントと内部データ定義を除いたJSX表示テキスト）

- `app/page.tsx:623`, `app/gym/page.tsx:343`: 「特定商取引法に基づく表記」— 法律で定められた正式名称のため、これは意図的・正当。翻訳対応は不要。
- `app/dashboard/page.tsx:329`: `<span>柔</span>` — デザイン上の装飾的一文字。意図的。

**判定**: 実質的な i18n 漏れは 0件。前フェーズの完全i18n化が有効に機能している。✅

---

### #22 くるくるローダー ✅
全ページに充実した Skeleton ローディングが実装済み（`dashboard/loading.tsx`, `profile/loading.tsx`, `techniques/loading.tsx`, `login/loading.tsx`）。Spinner は一切使用されていない。**これは顕著な強み。**

---

### #23 カクつく画面遷移 🟡
**該当**: `PersonalBests.tsx` — `bests` が `null → データあり` に変化する際、カードグリッドが 0件→6件に膨らみ高さが急増する。

**該当**: `TrainingChart.tsx`, `TrainingBarChart.tsx` — データフェッチ後にグラフ高さが確定するため、周囲要素が押し下げられる。

loading.tsx の Skeleton は page レベルで用意済みだが、**コンポーネント内のデータ更新**に起因する CLS は未対応。

**修正案**: 各コンポーネントに `min-h` を設定してスペースを事前確保。

---

### #24 コントラスト不足 🟡
**該当** (ダーク背景 `bg-zinc-950`/`bg-zinc-900` 上での低コントラストテキスト):

| ファイル | 箇所 | クラス | 用途 |
|---|---|---|---|
| `CollapsibleSection.tsx:22` | セクションラベル | `text-zinc-600` | 視認性低 |
| `ProStatusBanner.tsx:43` | サブテキスト | `text-zinc-600` | 視認性低 |
| `StreakFreeze.tsx:197` | 区切り文字 `·` | `text-gray-700` | ほぼ不可視 |
| `SkillMapPC.tsx:724` | ノード削除ボタン | `text-zinc-600` | 視認性低 |
| `SkillMapMobile.tsx:575` | エッジ削除ボタン | `text-zinc-600` | 視認性低 |

`text-zinc-600` は `#52525b` で、`bg-zinc-900`（`#18181b`）上のコントラスト比は約 4.2:1（WCAG AA基準 4.5:1 未達）。

**修正案**: `text-zinc-600` → `text-zinc-400` または `text-gray-400` に引き上げ。

---

### #25 余白の無法地帯 🟢
`NavBar.tsx`, `TechniqueLogList.tsx`, `TrainingLog.tsx` などで gap-1〜gap-6 が混在しているが、これは UIの階層（ナビアイテム間 / カード内 / セクション間）で意図的に異なるスペーシングを使い分けているものと判断。4の倍数ルールからの逸脱は軽微（gap-1, gap-3 など）。現状許容範囲内。

---

## サマリー

| 優先度 | 件数 | 項目 |
|---|---|---|
| 🔴 即修正 | 2 | #10 フォーカスリング欠落（a11y）、#14 削除ガードなし |
| 🟠 高優先 | 3 | #6 タップ領域不足、#7 Hover専用テキスト、#11 非同期ローディングなし |
| 🟡 中優先 | 5 | #2 モーダルスクロール、#12 Empty State、#18 テキスト truncate、#23 CLS、#24 コントラスト |
| 🟢 低優先 | 4 | #1 縦伸びリスト、#3 スクロールバー、#13 InstallBanner エラー、#17 バリデーション、#20 aria-label |
| ✅ クリア | 11 | #4 #5 #8 #9 #15 #16 #19 #21 #22 #25（一部）|

**特筆すべき強み**: #22（Skeleton完全実装）、#9（div-as-button ゼロ）、#21（i18n完全化）、#15（ナビ active state）は業界水準を超えるクオリティ。

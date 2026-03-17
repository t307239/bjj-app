## 📝 開発ログ
- Day 4ep (2026/03/17): **Batch I — CsvExport新規・ローディングスケルトン更新・日付範囲フィルター・BeltVisual SVG・今日クイック入力** 🎉
  **実装内容（5コミット）**:
    - I1: CsvExport.tsx 新規作成（commit: 8e759181）✅ — CSV一括エクスポート（フリーミアム核心機能）
      - 全training_logs → CSV変換 → BOM付きUTF-8 Blobダウンロード（Excel対応）
      - 日付・タイプ・時間(分)・メモの4列、日本語タイプラベル変換
    - I2: dashboard/loading.tsx 修正（commit: dc94497b）✅ — スケルトン更新
      - WeeklyStrip 7ドットスケルトン追加（GoalTrackerの前）
      - PersonalBests スケルトンを4→6セルに更新
    - I3+I5: components/TrainingLog.tsx 修正（commit: f6391e24）✅ — 日付範囲フィルター + 今日クイック入力
      - dateFrom/dateTo state + フィルターチェーン追加
      - 日付範囲UI: from/to日付input + ✕クリア + 先週/先月ショートカット
      - 記録フォームに「今日に戻す」ボタン（今日以外選択時のみ表示）
    - I4: components/ProfileForm.tsx 修正（commit: bfdf2ce1）✅ — BeltVisual SVG グラフィック追加
      - BeltVisual({ belt, stripe }) コンポーネント: SVG帯（本体+先端+白ストライプ）
      - ProfileViewCard の pill+dots を BeltVisual に置換
  **バグチェック**: 4ファイル全確認、✅ TOTAL ISSUES: 0

- Day 4eo (2026/03/17): **Batch H — PersonalBests拡張・月別グラフ6/12切替・タイプ分布期間フィルター・テクニックソート・WeeklyStrip新規** 🎉
  **実装内容（6コミット）**:
    - H1: `components/PersonalBests.tsx` 修正（commit: `62222e4d`）✅ — 4→6統計カードに拡張
      - `Bests` 型に `avgSessionMin` / `avgMonthly` 追加
      - avgSessionMin = round(totalMinutes/totalSessions) 計算
      - avgMonthly = round(totalSessions/monthKeys.length) 計算
      - アイテム配列を6件に: ⌛平均時間/回 + 📈月平均 追加
    - H2: `components/TrainingBarChart.tsx` 完全再構築（commit: `32cf5e92`）✅ — 6/12ヶ月範囲切替
      - data6 / data12 状態 + range: 6 | 12 state
      - buildBuckets(months) 関数で単一クエリから両方構築
      - 6月/12月トグルボタン追加（ヘッダー右上）
    - H3: `components/TrainingTypeChart.tsx` 修正（commit: `20911f5f`）✅ — 期間フィルター追加
      - allLogs に date+type 保存、period: "all"|"month"|"week" state
      - getPeriodStart(period) / toLocalDateStr(d) ヘルパー追加
      - クライアントサイドフィルター（全期間/今月/今週 3ボタン）
    - H4: `components/TechniqueLog.tsx` 修正（commit: `8073f83b`）✅ — ソートドロップダウン追加
      - sortBy: "newest"|"mastery_desc"|"mastery_asc"|"name" state
      - .slice().sort() で4モードソート
      - select ドロップダウンをヘッダータイトル横に配置
    - H5: `components/WeeklyStrip.tsx` 新規作成（commit: `9c141068`）✅ — 今週練習ドットストリップ
      - 月〜日の7つの円ドット表示（練習済=赤チェック、今日=赤枠、過去=灰、未来=薄灰）
      - 今週月曜〜日曜のSupabase日付範囲クエリ
      - ヘッダーに trainedThisWeek/totalPastDays 日カウント表示
    - H6: `app/dashboard/page.tsx` 修正（commit: `623e4b31`）✅ — WeeklyStrip統合
  **バグチェック**: 6ファイル全確認、✅ TOTAL ISSUES: 0

- Day 4ej+G (2026/03/17): **Batch G — UX改善バッチ完了** 🎉
  **実装内容**:
    - G1: `components/TrainingBarChart.tsx` 修正 ✅ (commit: `c312bb6e`)
      - UTCタイムゾーンバグ修正: `toISOString().substring(0,7)` → ローカル日付計算
      - 平均ライン追加: ダッシュボーダーを`relative`コンテナ内に絶対位置で重ねる
      - データのある月のみ対象の正確な平均計算
    - G2: `components/CompetitionStats.tsx` 新機能追加 ✅ (commit: `69227f0b`)
      - SVGドーナツチャートをW/L/Dの左に追加
      - `DonutSegment`コンポーネント: strokeDasharrayで円弧セグメント描画
      - 中夯SVGテキストに勝率％表示、花語green/red/yellowカラー
      - W/L/Dグリッドを右側に沿えた2カラムレイアウト
    - G3: `components/GoalTracker.tsx` 機能追加 ✅ (commit: `9177f32a`)
      - 全目標達成バナー: 設定された全目標が達成時に🎉表示
      - `activeGoalStates.every(g => g.current >= g.target)`で判定
    - G4: `components/TrainingLog.tsx` 機能追加 ✅ (commit: `556effef`)
      - キーワード検索入力追加（TechniqueLogと同一UX）
      - 日付・タイプ・メモでフィルタリング
      - クリア（×）ボタン付き検索インプット
      - 空メッセージ: 「《QUERY》に一致する記録はありません」
    - G5: `app/dashboard/loading.tsx` 修正 ✅ (commit: `278392c1`)
      - TrainingTypeChartスケルトン追加（円形スケルトン + 伝說Cells）
      - CompetitionStatsスケルトン追加（ドーナツ + W/L/Dグリッド）
  **バグチェック**: 18項目 ✅ TOTAL ISSUES: 0
  **次の優先タスク**（優先度順）:
    1. **CSVエクスポート** — フリーミアム有料機能の核
    2. **試合記録強化** — 勝敗・相手情報・試合名の専用フォーム
    3. **PWAプッシュ通知** — 目標達成時の激励通知
    4. **BJJ Wiki → アプリ導線** — Wikiページにアプリへのバナー設置

## 📝 開発ログ
- Day 4en (2026/03/17): **Batch F — TrainingChartトグル・習熟度分布バー・月次デルタ・期間フィルター・PersonalBests改善** 🎉
  **実装内容（5コミット）**:
    - F1: TrainingChart 完全再構築（commit: a83c8ba7）- 月別棒グラフモード追加
      - MonthData 型追加（ym / label / count / minutes）
      - viewMode: "heatmap" | "monthly" state + トグルボタン（"84日" / "月別"）
      - 単一クエリで過去12ヶ月取得 → ヒートマップ(84日) + 月別棒グラフ(6ヶ月) 両方に対応
    - F2: TechniqueLog 修正（commit: 896dac49）- 習熟度分布スタックバー追加
      - IIFEパターンで統計カード内に分布バー挿入
      - 5色（gray/blue/yellow/orange/green）の rounded-full スタックバー
    - F3: dashboard/page.tsx 修正（commit: 46a0922e）- 今月vs先月デルタ表示
      - prevMonthCount クエリ追加（.gte(firstDayOfPrevMonth).lt(firstDayOfMonth)）
      - 今月スタッツカードに ▲N vs 先月 / ▼N vs 先月 インジケーター追加（緑/赤）
    - F4: TrainingLog 修正（commit: 3fc70462）- 期間フィルター Pills 追加
      - periodFilter: "all" | "month" | "week" state 追加
      - getPeriodStart() — 今月1日 or 今週月曜日(日曜エッジケース対応)を返す
      - タイプフィルター上に期間 Pills（全期間 / 今月 / 今週）追加
    - F5: PersonalBests 修正（commit: a2009650）- 1件以上で表示
      - totalSessions < 3 ガード削除 → 1件以上のデータがあれば表示
      - uniqueDates.length > 0 ? 1 : 0 エッジケース修正
  **バグチェック**: 全5ファイル確認 TOTAL ISSUES: 0
  **コミット一覧**: a83c8ba7 / 896dac49 / 46a0922e / 3fc70462 / a2009650

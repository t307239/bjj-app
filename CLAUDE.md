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

# Pro Feature: 週次/月次パフォーマンスレポート PRD

## 概要
既存のtraining_logsデータから、ユーザーの練習パフォーマンスを自動集計・可視化するPro限定機能。入力コストゼロで「自分の成長が見える」価値を提供する。

## なぜ作るか
- 「入力コストが高い機能は使われない」原則に基づく
- 練習後の疲れた状態でも価値が得られる（既存データの自動分析）
- Proへのコンバージョン動機として最も広いユーザー層に刺さる

## UI/UX

### 配置
ダッシュボード（/dashboard）の StatusBar 下、AICoachCard の上に配置。

### カード構成: WeeklyReportCard
1. **ヘッダー**: 「今週のレポート」/ 「今月のレポート」（タブ切り替え）
2. **KPIセクション**: 
   - 練習回数（前週/前月比 delta 矢印）
   - 合計時間（前週/前月比 delta）
   - 平均時間/回
   - 最長連続練習日数
3. **練習タイプ分布**: 横バーチャート（Gi/No-Gi/Drilling/Competition/Open Mat/Recovery）
4. **週別トレンド**: 過去4-8週の練習回数折れ線
5. **インサイトテキスト**: ルールベースの一言コメント
   - 「先週より2回多く練習しています！」
   - 「Drillingの割合が減っています。技術練習を意識してみましょう」
   - 「3週連続で練習頻度が上がっています。素晴らしい継続力です！」

### 状態遷移
- **Loading**: StatusBar と同じ skeleton パターン
- **Empty（データ不足）**: 「レポートを生成するには、もう少し練習を記録しましょう（最低2週間分）」
- **Pro Gate（Free ユーザー）**: カード全体をぼかし（blur-sm） + 中央に「Proにアップグレードして詳細レポートを見る」CTA
- **Normal**: 上記KPI + チャート + インサイト

### Free ユーザーへのティーザー
- 今週の練習回数のみ表示（既にStatusBarで見える）
- 前週比のdeltaとトレンドチャートにblur-smオーバーレイ
- CTA: t("pricing.upgradeForReport")

## データフロー

### データソース
既存テーブル `training_logs` のみ。新テーブル・API不要。

### クエリ
Proユーザー: 過去56日間（8週間）のtraining_logsを取得（既にuseTrainingLogで取得済みのデータを流用可能、ただしFreeは1ヶ月制限あり）

### 集計ロジック（クライアントサイド useMemo）
- 週ごとにグルーピング（月曜始まり）
- 各週の回数・合計時間・タイプ分布を計算
- 前週/前月とのdeltaを算出
- 連続練習日数の計算

### インサイト生成（ルールベース）
LLM不使用。条件分岐でテキスト生成:
- delta > 0 → 増加メッセージ
- delta < 0 → 減少メッセージ（改善提案）
- streak >= 3 weeks → 継続力称賛
- type偏り → バランス提案

## コンポーネント設計
- 新規: `components/WeeklyReportCard.tsx`（メインカード）
- 新規: `hooks/useWeeklyReport.ts`（集計ロジックフック）
- 改修: `app/dashboard/page.tsx`（WeeklyReportCard配置）
- 改修: `messages/en.json`, `messages/ja.json`（i18nキー追加）

## 考慮した代替案
1. **LLM API でレポート生成** → コスト高・レイテンシ悪い。ルールベースで十分。AICoachCardと差別化。却下
2. **メール送信** → インフラ追加が重い。Phase 2で検討。
3. **独立ページ（/reports）** → ダッシュボード上のカードの方がエンゲージメント高い。却下
4. **Recharts で本格チャート** → バンドルサイズ増。CSS barで軽量実装。Phase 2で検討。

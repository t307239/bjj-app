/** ROBUST 入会プラン定義と料金計算の定数（登録画面から分離: 価格改定時に1ファイルで完結させるため） */

export type Plan = {
  id: string;
  label: string;
  price: string;
  priceKey: string;
  setupFee: number;
  monthlyAmount: number; // 日割り・翌月分計算用（税別）
  description: string;
};

export const PLANS: Plan[] = [
  {
    id: "fulltime_male",
    label: "フルタイム（男性）",
    price: "¥12,000/月",
    priceKey: "fulltime_male",
    setupFee: 10000,
    monthlyAmount: 12000,
    description: "通い放題・全クラス参加可",
  },
  {
    id: "fulltime_female",
    label: "フルタイム（女性・中高生）",
    price: "¥10,000/月",
    priceKey: "fulltime_female",
    setupFee: 5000,
    monthlyAmount: 10000,
    description: "通い放題・全クラス参加可",
  },
  {
    id: "twice_male",
    label: "月8回（男性）",
    price: "¥10,000/月",
    priceKey: "twice_male",
    setupFee: 10000,
    monthlyAmount: 10000,
    description: "月8回まで。超過は¥2,200/回",
  },
  {
    id: "twice_kids",
    label: "月8回（キッズ）",
    price: "¥7,000/月",
    priceKey: "twice_kids",
    setupFee: 0,
    monthlyAmount: 7000,
    description: "小学生対象・月8回まで",
  },
  {
    id: "drop_in",
    label: "ビジター（ドロップイン）",
    price: "¥2,000/回",
    priceKey: "drop_in",
    setupFee: 0,
    monthlyAmount: 2000,
    description: "単発参加",
  },
];

// 消費税率（外税10%）。表示価格はすべて税別で、決済内訳・合計に消費税を加算する。
export const CONSUMPTION_TAX_RATE = 0.1;
// JSTオフセット。日割り計算をサーバー(JST)と一致させ、端末TZ差でズレないようにする。
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

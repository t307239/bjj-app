// ROBUST 共通の表示ラベル・色。
// Why: プラン名・帯・ステータスの日本語表記が7ファイルに複製されていた。1か所に集約し、
//      表記変更(例: プラン名の改称)が全画面とCSVに漏れなく反映されるようにする。
// ⚠️ クライアント/サーバー両方からインポートされるため、サーバー専用APIは import しない。

/** プラン種別(gym_members.plan_type)の表示名 */
export const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム",
  twice_weekly: "月8回",
  drop_in: "ドロップイン",
};

/** 帯の表示名 */
export const BELT_LABEL: Record<string, string> = {
  white: "白帯",
  blue: "青帯",
  purple: "紫帯",
  brown: "茶帯",
  black: "黒帯",
};

/** 会員ステータス(gym_members.status)の表示名 */
export const STATUS_LABEL: Record<string, string> = {
  active: "有効",
  paused: "休会中",
  cancelled: "退会",
};

/** 会員ステータスのバッジ色(Tailwind) */
export const STATUS_COLOR: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  cancelled: "bg-red-500/20 text-red-400",
};

/** 支払方法(gym_members.payment_method)の表示名 */
export const PAYMENT_LABEL: Record<string, string> = {
  stripe: "カード（Stripe）",
  bank_transfer: "口座振替",
};

/** 昇格履歴1件(member_promotions)。管理画面・会員プロフィールで共通 */
export type Promotion = {
  id: string;
  belt: string;
  stripes: number;
  promoted_on: string;
  note: string | null;
};

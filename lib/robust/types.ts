// ROBUST ジム会員管理システム — 型定義
// CHECK制約ではなくここで管理することで、新プラン追加時に
// TypeScript がswitch文の漏れを全部コンパイルエラーで教えてくれる

export const PLAN_TYPES = ['fulltime', 'twice_weekly', 'drop_in'] as const;
export type PlanType = typeof PLAN_TYPES[number];

export const MEMBER_STATUSES = ['active', 'paused', 'cancelled'] as const;
export type MemberStatus = typeof MEMBER_STATUSES[number];

export const PAYMENT_METHODS = ['stripe', 'bank_transfer'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export const STAFF_ROLES = ['owner', 'admin', 'instructor'] as const;
export type StaffRole = typeof STAFF_ROLES[number];

export const CLASS_TYPES = ['beginner', 'basic', 'regular', 'nogi', 'private', 'other'] as const;
export type ClassType = typeof CLASS_TYPES[number];

export const GYM_FEATURES = ['attendance', 'payments', 'videos'] as const;
export type GymFeature = typeof GYM_FEATURES[number];

// DB 行型
export type Gym = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  plan_cap: number;
  overage_yen: number;
  features: GymFeature[];
  created_at: string;
  updated_at: string;
};

export type GymMember = {
  id: string;
  gym_id: string;
  user_id: string | null;
  email: string;
  name: string;
  phone: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birth_year: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  default_payment_method_id: string | null;
  payment_method: PaymentMethod;
  qr_token: string;
  plan_type: PlanType;
  plan_cap: number | null;
  status: MemberStatus;
  insurance_expires_at: string | null;
  is_minor: boolean;
  guardian_consent: boolean;
  guardian_name: string | null;
  guardian_contact: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceLog = {
  id: string;
  member_id: string;
  gym_id: string;
  class_type: ClassType | null;
  checked_in_at: string;
  billing_period: string;
  charged: boolean;
  created_at: string;
  updated_at: string;
};

export type GymVideo = {
  id: string;
  gym_id: string;
  title: string;
  description: string | null;
  drive_file_id: string;
  thumbnail_url: string | null;
  class_type: ClassType | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

// Stripe plan_id マッピング
export const STRIPE_PRICE_IDS: Record<string, string> = {
  fulltime_male:   process.env.STRIPE_ROBUST_PRICE_FULLTIME_MALE   ?? '',
  fulltime_female: process.env.STRIPE_ROBUST_PRICE_FULLTIME_FEMALE ?? '',
  twice_male:      process.env.STRIPE_ROBUST_PRICE_TWICE_MALE      ?? '',
  twice_kids:      process.env.STRIPE_ROBUST_PRICE_TWICE_KIDS      ?? '',
  drop_in:         process.env.STRIPE_ROBUST_PRICE_DROP_IN         ?? '',
};

export const CHECKIN_COOLDOWN_MINUTES = 60;

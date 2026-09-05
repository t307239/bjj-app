import { NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

/**
 * 会員データCSVエクスポート（オーナー・管理者のみ）。
 * Why: 事業継続・引き継ぎ用。管理者が不在になっても会員情報（連絡先・緊急連絡先・
 *      プラン・保険期限など）を外部に取り出せるようにする。個人情報を含むため
 *      requireRobustManager で instructor を締め出す。
 */

// CSVセルのエスケープ: 常にダブルクォート囲み＋内部のクォートは二重化。null/undefinedは空。
// Why: 氏名・住所にカンマ/改行/引用符が含まれても列崩れしないようにするため。
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

const BELT_LABEL: Record<string, string> = {
  white: "白帯",
  blue: "青帯",
  purple: "紫帯",
  brown: "茶帯",
  black: "黒帯",
};
const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム",
  twice_weekly: "月8回",
  drop_in: "ドロップイン",
};
const STATUS_LABEL: Record<string, string> = {
  active: "有効",
  paused: "休会中",
  cancelled: "退会",
};
const PAYMENT_LABEL: Record<string, string> = {
  stripe: "カード（Stripe）",
  bank: "口座振替",
};

type MemberRow = {
  name: string | null;
  name_kana: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  gender: string | null;
  blood_type: string | null;
  plan_type: string | null;
  plan_cap: number | null;
  status: string | null;
  belt: string | null;
  stripes: number | null;
  payment_method: string | null;
  insurance_expires_at: string | null;
  is_minor: boolean | null;
  guardian_consent: boolean | null;
  guardian_name: string | null;
  guardian_contact: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  family_discount: boolean | null;
  family_member_name: string | null;
  video_access: boolean | null;
  google_email: string | null;
  sports_history: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  injury_history: string | null;
  medical_notes: string | null;
  created_at: string | null;
  qr_token: string | null;
  stripe_customer_id: string | null;
};

const yesNo = (b: boolean | null): string => (b === null ? "" : b ? "はい" : "いいえ");
// timestamptz → JST の日付(YYYY-MM-DD)。Why: UTC切り出しだと深夜に日付がずれるため明示的にJST変換。
const jstDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) : "";

const COLUMNS: { header: string; get: (m: MemberRow) => unknown }[] = [
  { header: "氏名", get: (m) => m.name },
  { header: "フリガナ", get: (m) => m.name_kana },
  { header: "メール", get: (m) => m.email },
  { header: "電話", get: (m) => m.phone },
  { header: "住所", get: (m) => m.address },
  { header: "生年月日", get: (m) => m.birth_date },
  { header: "性別", get: (m) => m.gender },
  { header: "血液型", get: (m) => m.blood_type },
  { header: "プラン", get: (m) => PLAN_LABEL[m.plan_type ?? ""] ?? m.plan_type },
  { header: "月上限回数", get: (m) => m.plan_cap },
  { header: "ステータス", get: (m) => STATUS_LABEL[m.status ?? ""] ?? m.status },
  { header: "帯", get: (m) => BELT_LABEL[m.belt ?? ""] ?? m.belt },
  { header: "ストライプ", get: (m) => m.stripes },
  { header: "支払方法", get: (m) => PAYMENT_LABEL[m.payment_method ?? ""] ?? m.payment_method },
  { header: "保険期限", get: (m) => m.insurance_expires_at },
  { header: "未成年", get: (m) => yesNo(m.is_minor) },
  { header: "保護者同意", get: (m) => yesNo(m.guardian_consent) },
  { header: "保護者氏名", get: (m) => m.guardian_name },
  { header: "保護者連絡先", get: (m) => m.guardian_contact },
  { header: "緊急連絡先氏名", get: (m) => m.emergency_contact_name },
  { header: "緊急連絡先電話", get: (m) => m.emergency_contact_phone },
  { header: "緊急連絡先続柄", get: (m) => m.emergency_contact_relation },
  { header: "家族割引", get: (m) => yesNo(m.family_discount) },
  { header: "家族名", get: (m) => m.family_member_name },
  { header: "動画アクセス", get: (m) => yesNo(m.video_access) },
  { header: "Google連携メール", get: (m) => m.google_email },
  { header: "運動歴", get: (m) => m.sports_history },
  { header: "持病", get: (m) => m.chronic_conditions },
  { header: "アレルギー", get: (m) => m.allergies },
  { header: "怪我歴", get: (m) => m.injury_history },
  { header: "備考", get: (m) => m.medical_notes },
  { header: "入会日", get: (m) => jstDate(m.created_at) },
  { header: "QRトークン", get: (m) => m.qr_token },
  { header: "Stripe顧客ID", get: (m) => m.stripe_customer_id },
];

const SELECT_COLUMNS =
  "name,name_kana,email,phone,address,birth_date,gender,blood_type,plan_type,plan_cap,status,belt,stripes,payment_method,insurance_expires_at,is_minor,guardian_consent,guardian_name,guardian_contact,emergency_contact_name,emergency_contact_phone,emergency_contact_relation,family_discount,family_member_name,video_access,google_email,sports_history,chronic_conditions,allergies,injury_history,medical_notes,created_at,qr_token,stripe_customer_id";

export async function GET() {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("gym_members")
    .select(SELECT_COLUMNS)
    .eq("gym_id", GYM_ID)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "エクスポートに失敗しました" }, { status: 500 });
  }

  const members = (data ?? []) as unknown as MemberRow[];
  const headerLine = COLUMNS.map((c) => csvCell(c.header)).join(",");
  const rows = members.map((m) => COLUMNS.map((c) => csvCell(c.get(m))).join(","));

  // Why: Excel(Windows/Mac)が日本語CSVをUTF-8と認識するよう先頭にBOM。改行はCRLFで統一。
  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [headerLine, ...rows].join("\r\n") + "\r\n";

  const filename = `robust_members_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

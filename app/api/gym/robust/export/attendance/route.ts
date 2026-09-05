import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

/**
 * 来館（出席）データの期間指定CSVエクスポート（オーナー・管理者のみ）。
 * Why: 「この期間に誰が何回来たか」を売上・稼働レポートや月次集計に使えるように。
 *      会員マスタCSV(/export)とは別で、出席ログを日付範囲で出力する。
 * クエリ: ?from=YYYY-MM-DD&to=YYYY-MM-DD（JSTの日付。省略時は今月1日〜今日）。
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

const PLAN_LABEL: Record<string, string> = {
  fulltime: "フルタイム",
  twice_weekly: "月8回",
  drop_in: "ドロップイン",
};
const BELT_LABEL: Record<string, string> = {
  white: "白帯",
  blue: "青帯",
  purple: "紫帯",
  brown: "茶帯",
  black: "黒帯",
};
const STATUS_LABEL: Record<string, string> = {
  active: "有効",
  paused: "休会中",
  cancelled: "退会",
};
// timestamptz → JSTの日付(YYYY-MM-DD)。入会日など。
const jstDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) : "";

// JSTの「今日」および「今月1日」をYYYY-MM-DDで返す。
function jstToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function jstMonthStart(): string {
  return jstToday().slice(0, 7) + "-01";
}

// 埋め込みする会員情報（会員CSVと同等の詳細）。Why: 来館1件ごとに会員の連絡先・住所・
// 緊急連絡先などフル情報を付けて、単体で完結する来館レポートにするため。
type MemberInfo = {
  name: string | null;
  name_kana: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  plan_type: string | null;
  belt: string | null;
  stripes: number | null;
  status: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  insurance_expires_at: string | null;
  created_at: string | null;
};

// 出席ログ1件（gym_members を埋め込み）。埋め込みは配列/単体どちらの型にもなり得るため広めに受ける。
type AttendanceRow = {
  checked_in_at: string | null;
  class_type: string | null;
  charged: boolean | null;
  gym_members: MemberInfo | MemberInfo[] | null;
};

const MEMBER_SELECT =
  "name, name_kana, email, phone, address, birth_date, plan_type, belt, stripes, status, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, insurance_expires_at, created_at";

function pickMember(m: AttendanceRow["gym_members"]) {
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

export async function GET(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || jstMonthStart();
  const to = searchParams.get("to") || jstToday();

  // Why: 不正な日付でのクエリ・インジェクションを防ぐため厳密にフォーマット検証。
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "日付は YYYY-MM-DD 形式で指定してください" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "開始日は終了日以前にしてください" }, { status: 400 });
  }

  // JSTの日付範囲をUTCのタイムスタンプ境界に変換（from 00:00:00 JST 〜 to 23:59:59.999 JST）。
  const fromTs = new Date(`${from}T00:00:00+09:00`).toISOString();
  const toTs = new Date(`${to}T23:59:59.999+09:00`).toISOString();

  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("attendance_logs")
    .select(`checked_in_at, class_type, charged, gym_members(${MEMBER_SELECT})`)
    .eq("gym_id", GYM_ID)
    .gte("checked_in_at", fromTs)
    .lte("checked_in_at", toTs)
    .order("checked_in_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "エクスポートに失敗しました" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as AttendanceRow[];
  // Why: 来館情報（日時・クラス・超過課金）に加え、会員CSVと同等の会員詳細（住所・連絡先・
  //      緊急連絡先・帯・保険期限・入会日など）を各行に付けて、単体で完結する来館レポートにする。
  const headers = [
    "日付", "時刻", "クラス", "超過課金",
    "会員名", "フリガナ", "メール", "電話", "住所", "生年月日",
    "プラン", "帯", "ストライプ", "ステータス",
    "緊急連絡先氏名", "緊急連絡先電話", "緊急連絡先続柄", "保険期限", "入会日",
  ];
  const headerLine = headers.map(csvCell).join(",");

  const bodyLines = rows.map((r) => {
    const m = pickMember(r.gym_members);
    const dt = r.checked_in_at ? new Date(r.checked_in_at) : null;
    const date = dt ? dt.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) : "";
    const time = dt
      ? dt.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" })
      : "";
    return [
      date,
      time,
      r.class_type ?? "",
      r.charged ? "超過あり（¥2,200）" : "－",
      m?.name ?? "",
      m?.name_kana ?? "",
      m?.email ?? "",
      m?.phone ?? "",
      m?.address ?? "",
      m?.birth_date ?? "",
      PLAN_LABEL[m?.plan_type ?? ""] ?? m?.plan_type ?? "",
      BELT_LABEL[m?.belt ?? ""] ?? m?.belt ?? "",
      m?.stripes ?? "",
      STATUS_LABEL[m?.status ?? ""] ?? m?.status ?? "",
      m?.emergency_contact_name ?? "",
      m?.emergency_contact_phone ?? "",
      m?.emergency_contact_relation ?? "",
      m?.insurance_expires_at ?? "",
      jstDate(m?.created_at ?? null),
    ]
      .map(csvCell)
      .join(",");
  });

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [headerLine, ...bodyLines].join("\r\n") + "\r\n";
  const filename = `robust_attendance_${from}_${to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

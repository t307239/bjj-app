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

// JSTの「今日」および「今月1日」をYYYY-MM-DDで返す。
function jstToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function jstMonthStart(): string {
  return jstToday().slice(0, 7) + "-01";
}

// 出席ログ1件（gym_members を埋め込み）。Supトの埋め込みは配列/単体どちらの型にもなり得るため広めに受ける。
type AttendanceRow = {
  checked_in_at: string | null;
  class_type: string | null;
  charged: boolean | null;
  gym_members:
    | { name: string | null; email: string | null; plan_type: string | null }
    | { name: string | null; email: string | null; plan_type: string | null }[]
    | null;
};

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
    .select("checked_in_at, class_type, charged, gym_members(name, email, plan_type)")
    .eq("gym_id", GYM_ID)
    .gte("checked_in_at", fromTs)
    .lte("checked_in_at", toTs)
    .order("checked_in_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "エクスポートに失敗しました" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as AttendanceRow[];
  const headers = ["日付", "時刻", "会員名", "メール", "プラン", "クラス", "課金対象"];
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
      m?.name ?? "",
      m?.email ?? "",
      PLAN_LABEL[m?.plan_type ?? ""] ?? m?.plan_type ?? "",
      r.class_type ?? "",
      r.charged === null ? "" : r.charged ? "課金" : "無料",
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

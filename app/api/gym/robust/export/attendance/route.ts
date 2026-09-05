import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustManager } from "@/lib/robust/auth";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

/**
 * 来館サマリーCSV（月別来館回数）エクスポート（オーナー・管理者のみ）。
 * Why: 「各月に誰が何回来たか」を一覧化して稼働・売上分析に使う。会員の詳細情報は
 *      会員CSV(/export)に分離し、こちらは会員×月の回数マトリクスに徹する。
 * クエリ: ?from=YYYY-MM-DD&to=YYYY-MM-DD（JSTの日付。省略時は今月1日〜今日）。
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function jstToday(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function jstMonthStart(): string {
  return jstToday().slice(0, 7) + "-01";
}
// checked_in_at(UTC) → JSTの月(YYYY-MM)。
function jstMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
}

// from〜to の月(YYYY-MM)を昇順で列挙。列見出しに使う。
function monthsInRange(fromYm: string, toYm: string): string[] {
  const out: string[] = [];
  let [y, m] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  // Why: 範囲が広いと列は増えるが、月次の来館回数を横並びで俯瞰できるようにする。
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

type MemberLite = { name: string | null; email: string | null };
type AttendanceRow = {
  checked_in_at: string | null;
  gym_members: MemberLite | MemberLite[] | null;
};

function pickMember(m: AttendanceRow["gym_members"]): MemberLite | null {
  if (Array.isArray(m)) return m[0] ?? null;
  return m;
}

// Why: プラン等の会員属性は会員CSVに集約し、来館サマリーは「会員名＋メール（紐付けキー）＋
//      月別回数」に絞って2CSVの重複を最小化する。
type Agg = { name: string; email: string; counts: Record<string, number>; total: number };

export async function GET(req: NextRequest) {
  const auth = await requireRobustManager();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || jstMonthStart();
  const to = searchParams.get("to") || jstToday();

  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "日付は YYYY-MM-DD 形式で指定してください" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "開始日は終了日以前にしてください" }, { status: 400 });
  }

  const fromTs = new Date(`${from}T00:00:00+09:00`).toISOString();
  const toTs = new Date(`${to}T23:59:59.999+09:00`).toISOString();

  const admin = createRobustAdminClient();
  const { data, error } = await admin
    .from("attendance_logs")
    .select("checked_in_at, gym_members(name, email)")
    .eq("gym_id", GYM_ID)
    .gte("checked_in_at", fromTs)
    .lte("checked_in_at", toTs)
    .order("checked_in_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "エクスポートに失敗しました" }, { status: 500 });
  }

  const months = monthsInRange(from.slice(0, 7), to.slice(0, 7));
  const rows = (data ?? []) as unknown as AttendanceRow[];

  // 会員(email)ごとに月別カウントを集計。
  const byMember = new Map<string, Agg>();
  for (const r of rows) {
    const m = pickMember(r.gym_members);
    if (!m || !r.checked_in_at) continue;
    const key = m.email ?? m.name ?? "unknown";
    let agg = byMember.get(key);
    if (!agg) {
      agg = { name: m.name ?? "", email: m.email ?? "", counts: {}, total: 0 };
      byMember.set(key, agg);
    }
    const ym = jstMonth(r.checked_in_at);
    agg.counts[ym] = (agg.counts[ym] ?? 0) + 1;
    agg.total += 1;
  }

  const aggs = [...byMember.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));

  const header = ["会員名", "メール", ...months, "合計"];
  const headerLine = header.map(csvCell).join(",");
  const bodyLines = aggs.map((a) =>
    [a.name, a.email, ...months.map((ym) => a.counts[ym] ?? 0), a.total].map(csvCell).join(","),
  );
  // 末尾に月別合計（全員）の行を付ける。
  const totalRow = [
    "（月合計）",
    "",
    ...months.map((ym) => aggs.reduce((s, a) => s + (a.counts[ym] ?? 0), 0)),
    aggs.reduce((s, a) => s + a.total, 0),
  ]
    .map(csvCell)
    .join(",");

  const BOM = String.fromCharCode(0xfeff);
  const csv = BOM + [headerLine, ...bodyLines, totalRow].join("\r\n") + "\r\n";
  const filename = `robust_attendance_summary_${from}_${to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

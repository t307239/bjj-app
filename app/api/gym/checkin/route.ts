import { NextRequest, NextResponse } from "next/server";
import { getMemberByQrToken } from "@/lib/robust/member";
import { checkIn } from "@/lib/robust/attendance";
import type { ClassType } from "@/lib/robust/types";
import { z } from "zod";
import { clientLogger } from "@/lib/clientLogger";

// Why: auth:public エンドポイントのため QRトークン総当たり攻撃を防ぐ。
//      Vercel Serverless はインスタンスをまたぐと揮発するが、
//      チェックインは実際のタブレット1台からのスキャンなので
//      1分10回(=6秒に1回)制限で十分。MAU増加後は Upstash Redis に移行推奨。
const ipRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // 1分あたり最大10回
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const bodySchema = z.object({
  qrToken: z.string().uuid(),
  gymId: z.string().uuid(),
  classType: z.enum(["beginner","basic","regular","nogi","private","other"]).optional(),
});

// auth: public — qr_token 認証 + IP rate-limit
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "リクエストが多すぎます。しばらく待ってから再試行してください。", success: false }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
  }

  const { qrToken, gymId, classType } = parsed.data;

  const member = await getMemberByQrToken(qrToken);
  if (!member) {
    return NextResponse.json({ error: "無効なQRコードです", success: false }, { status: 404 });
  }

  if (member.gym_id !== gymId) {
    return NextResponse.json({ error: "このジムのQRコードではありません", success: false }, { status: 403 });
  }

  try {
    const result = await checkIn(member, gymId, classType as ClassType | undefined);

    return NextResponse.json({
      success: true,
      duplicate: result.duplicate,
      overcharged: result.overcharged,
      member_name: member.name,
      message: result.duplicate
        ? "既にチェックイン済みです（60分以内）"
        : result.overcharged
        ? `チェックイン完了（今月の上限を超えました。¥1,000が翌月請求に追加されます）`
        : "チェックイン完了！",
    });
  } catch (err) {
    clientLogger.error("robust.checkin.error", { memberId: member.id }, err);
    return NextResponse.json({ error: "チェックインに失敗しました", success: false }, { status: 500 });
  }
}

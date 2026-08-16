import { NextRequest, NextResponse } from "next/server";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { requireRobustAuth } from "@/lib/robust/auth";
import { z } from "zod";

const GYM_ID = process.env.NEXT_PUBLIC_ROBUST_GYM_ID ?? "";

// 依頼書 Section 15: 会員のプッシュ通知購読の保存/削除
// auth: public — requireRobustAuth で本人のみ

const postSchema = z.object({
  endpoint: z.string().url().max(2048),
  timezone: z.string().max(64).default("Asia/Tokyo"),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export async function POST(req: NextRequest) {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const admin = createRobustAdminClient();

  // ログインユーザーの gym_members レコードを特定（購読を会員に紐付ける）
  const { data: member } = await admin
    .from("gym_members")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "会員情報が見つかりません" }, { status: 404 });

  // endpoint 一意で upsert（同一端末の再購読を冪等に上書き）
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        gym_id: GYM_ID,
        member_id: member.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth_key: parsed.data.keys.auth,
        timezone: parsed.data.timezone,
      },
      { onConflict: "endpoint" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.object({ endpoint: z.string().url().max(2048) });

export async function DELETE(req: NextRequest) {
  const auth = await requireRobustAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });

  const admin = createRobustAdminClient();

  // 本人の会員IDを解決し、その会員の購読のみ削除（他人の endpoint を消せないよう owner filter）
  const { data: member } = await admin
    .from("gym_members")
    .select("id")
    .eq("user_id", auth.userId)
    .eq("gym_id", GYM_ID)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "会員情報が見つかりません" }, { status: 404 });

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data.endpoint)
    .eq("member_id", member.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

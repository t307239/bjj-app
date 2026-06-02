import Stripe from "stripe";
import { createRobustAdminClient } from "@/lib/robust/supabase";
import { getGymBySlug } from "@/lib/robust/member";

export async function handleCheckoutCompleted(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // client_reference_id = Supabase Auth の user_id
  const userId = session.client_reference_id;
  if (!userId) throw new Error("client_reference_id が未設定");

  const gymSlug = extractGymSlug(session.success_url ?? "");
  if (!gymSlug) throw new Error("gym slug を success_url から取得できません");

  const gym = await getGymBySlug(gymSlug);
  if (!gym) throw new Error(`ジムが見つかりません: ${gymSlug}`);

  const supabase = createRobustAdminClient();

  // カゴ落ちの冪等性: すでに登録済みなら何もしない
  const { data: existing } = await supabase
    .from("gym_members")
    .select("id")
    .eq("user_id", userId)
    .eq("gym_id", gym.id)
    .maybeSingle();

  if (existing) return;

  // Stripe Customer からメール取得
  const email = session.customer_email ?? session.customer_details?.email ?? "";

  // plan_type を metadata or subscription から推定
  // ※ 登録時に session.metadata.planKey をセットする必要あり
  const planKey = session.metadata?.planKey ?? "fulltime";
  const planType = planKey.startsWith("twice") ? "twice_weekly"
    : planKey === "drop_in" ? "drop_in"
    : "fulltime";

  await supabase.from("gym_members").insert({
    gym_id: gym.id,
    user_id: userId,
    email,
    name: session.customer_details?.name ?? "",
    // メタデータからプロフィール情報を復元
    phone: session.metadata?.phone || null,
    address: session.metadata?.address || null,
    sports_history: session.metadata?.sports_history || null,
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: session.subscription as string | null,
    payment_method: "stripe",
    qr_token: crypto.randomUUID(),
    plan_type: planType,
    plan_cap: planType === "twice_weekly" ? gym.plan_cap : null,
    status: "active",
    video_access: false, // デフォルト非公開。admin から個別に有効化
  });
}

function extractGymSlug(url: string): string | null {
  const match = url.match(/\/gym\/([^/]+)\//);
  return match?.[1] ?? null;
}

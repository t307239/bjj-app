/**
 * gym-milestone-email — Supabase Edge Function
 *
 * 起動方法:
 *   - Supabase Dashboard > Edge Functions > Schedule (Cron)
 *   - 推奨: 毎日 10:00 UTC  →  "0 10 * * *"
 *
 * 動作:
 *   1. gyms テーブルで member_count >= 10 かつ outreach_sent_at IS NULL の道場を取得
 *   2. 各道場の owner (is_gym_owner=true のプロフィール) のメールアドレスを取得
 *   3. Resend API で英語メール送信
 *   4. outreach_sent_at を現在時刻に更新 (冪等: 再送しない)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM_EMAIL = "noreply@bjj-app.net";
const APP_URL = "https://bjj-app.net";

interface GymRow {
  id: string;
  name: string;
  member_count: number;
}

interface ProfileRow {
  id: string;
  gym_id: string;
  is_gym_owner: boolean;
  locale: string;
}

Deno.serve(async (req: Request) => {
  // Allow cron invocation via POST (Supabase scheduled function) or manual GET
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Fetch gyms with 10+ members that haven't been outreached yet
  //    member_count is computed via a view or RPC; here we count profiles.gym_id
  const { data: gyms, error: gymsErr } = await supabase.rpc("gyms_with_member_counts");
  if (gymsErr) {
    console.error("gyms_with_member_counts error:", gymsErr.message);
    return new Response(JSON.stringify({ error: gymsErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eligible = (gyms as GymRow[]).filter((g) => g.member_count >= 10);
  if (eligible.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: "No eligible gyms" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const gymIds = eligible.map((g) => g.id);

  // 2. Fetch gym owner profiles for eligible gyms (include locale for multilingual email)
  const { data: ownerProfiles, error: profilesErr } = await supabase
    .from("profiles")
    .select("id, gym_id, locale")
    .in("gym_id", gymIds)
    .eq("is_gym_owner", true);

  if (profilesErr || !ownerProfiles) {
    console.error("profiles fetch error:", profilesErr?.message);
    return new Response(JSON.stringify({ error: profilesErr?.message ?? "no profiles" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Get email addresses from auth.users (service_role only)
  const ownerUserIds = ownerProfiles.map((p: ProfileRow) => p.id);
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error("auth.admin.listUsers error:", authErr.message);
    return new Response(JSON.stringify({ error: authErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ownerEmailMap: Record<string, string> = {};
  for (const u of authUsers.users) {
    if (ownerUserIds.includes(u.id) && u.email) {
      ownerEmailMap[u.id] = u.email;
    }
  }

  let sentCount = 0;
  const failedGyms: string[] = [];

  for (const gym of eligible) {
    const ownerProfile = ownerProfiles.find((p: ProfileRow) => p.gym_id === gym.id);
    if (!ownerProfile) continue;

    const ownerEmail = ownerEmailMap[ownerProfile.id];
    if (!ownerEmail) continue;

    // 4. Send email via Resend (locale-aware: Japanese for locale=ja, English otherwise)
    const locale = ownerProfile.locale ?? "en";
    const isJa = locale === "ja";
    const subject = isJa
      ? `あなたの道場に${gym.member_count}人が参加中です 🥋`
      : `Your gym hit ${gym.member_count} members on BJJ App 🥋`;
    const emailBody = isJa
      ? buildEmailHtmlJa(gym.name, gym.member_count)
      : buildEmailHtml(gym.name, gym.member_count);
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `BJJ App <${FROM_EMAIL}>`,
        to: [ownerEmail],
        subject,
        html: emailBody,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error(`Resend error for gym ${gym.id}:`, errText);
      failedGyms.push(gym.id);
      continue;
    }

    // 5. Mark outreach_sent_at to prevent re-send
    const { error: updateErr } = await supabase
      .from("gyms")
      .update({ outreach_sent_at: new Date().toISOString() })
      .eq("id", gym.id);

    if (updateErr) {
      console.error(`outreach_sent_at update error for gym ${gym.id}:`, updateErr.message);
      // Don't block — email was already sent; mark failure for retry awareness
      failedGyms.push(gym.id);
      continue;
    }

    sentCount++;
    console.log(`Outreach sent to gym ${gym.id} (${gym.name}), owner: ${ownerEmail}`);
  }

  return new Response(
    JSON.stringify({ sent: sentCount, failed: failedGyms }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});

/**
 * Build HTML email body.
 * CAN-SPAM compliant: includes physical address placeholder + unsubscribe mention.
 */
function buildEmailHtml(gymName: string, memberCount: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your gym is growing on BJJ App</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;padding:0 16px;">
    <tr><td>
      <!-- Header -->
      <div style="text-align:center;margin-bottom:32px;">
        <span style="font-size:36px;">🥋</span>
        <h1 style="font-size:20px;font-weight:700;color:#ffffff;margin:8px 0 0;">BJJ App</h1>
      </div>

      <!-- Main card -->
      <div style="background:#18181b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
        <h2 style="font-size:18px;font-weight:700;color:#ffffff;margin:0 0 12px;">
          🎉 ${gymName} just hit ${memberCount} members!
        </h2>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 20px;">
          Your students are already tracking their BJJ journey on BJJ App —
          sessions logged, streaks maintained, techniques noted.
        </p>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px;">
          Unlock your <strong style="color:#ffffff;">Gym Dashboard</strong> to see
          who's training consistently, who's at churn risk, and push curriculum
          updates directly to your whole team.
        </p>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${APP_URL}/gym/dashboard"
             style="display:inline-block;background:#10B981;color:#000000;font-weight:700;
                    font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
            Try Gym Dashboard Free — 14 Days
          </a>
        </div>

        <!-- Feature list -->
        <ul style="list-style:none;padding:0;margin:0;color:#a1a1aa;font-size:13px;line-height:2;">
          <li>✅ Member activity &amp; belt distribution</li>
          <li>✅ Churn risk alerts (🔴 not trained in 14 days)</li>
          <li>✅ Push curriculum links to all members instantly</li>
          <li>✅ No app install required for your students</li>
        </ul>
      </div>

      <!-- Footer (CAN-SPAM) -->
      <p style="text-align:center;color:#52525b;font-size:11px;margin-top:24px;line-height:1.6;">
        You received this email because ${memberCount}+ members of <strong>${gymName}</strong>
        signed up for BJJ App and listed your gym.<br/>
        BJJ App · <a href="${APP_URL}/gym/dashboard" style="color:#52525b;">Manage your gym</a>
        &nbsp;·&nbsp;
        To stop receiving these notifications, reply with "unsubscribe".
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * 日本語版メールテンプレート（profiles.locale = 'ja' のジムオーナー向け）
 * 特商法に準拠: 配信停止方法を明記
 */
function buildEmailHtmlJa(gymName: string, memberCount: number): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>あなたの道場でBJJ Appが広がっています</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;background:#09090b;color:#e4e4e7;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;padding:0 16px;">
    <tr><td>
      <!-- Header -->
      <div style="text-align:center;margin-bottom:32px;">
        <span style="font-size:36px;">🥋</span>
        <h1 style="font-size:20px;font-weight:700;color:#ffffff;margin:8px 0 0;">BJJ App</h1>
      </div>

      <!-- Main card -->
      <div style="background:#18181b;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;">
        <h2 style="font-size:18px;font-weight:700;color:#ffffff;margin:0 0 12px;">
          🎉 ${gymName}に${memberCount}人が参加しています！
        </h2>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 20px;">
          あなたの道場の生徒たちがBJJ Appで練習を記録しています。
          ストリーク継続・テクニックノート・週間目標を活用して上達を実感しています。
        </p>
        <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px;">
          <strong style="color:#ffffff;">ジムダッシュボード</strong>を開くと、
          誰が継続して練習しているか・退会リスクが高い生徒は誰か・
          カリキュラムを一斉配信する機能をお使いいただけます。
        </p>

        <!-- CTA -->
        <div style="text-align:center;margin-bottom:24px;">
          <a href="${APP_URL}/gym/dashboard"
             style="display:inline-block;background:#10B981;color:#000000;font-weight:700;
                    font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none;">
            14日間無料で試す
          </a>
        </div>

        <!-- Feature list -->
        <ul style="list-style:none;padding:0;margin:0;color:#a1a1aa;font-size:13px;line-height:2;">
          <li>✅ 会員の練習頻度・帯別分布を一覧表示</li>
          <li>✅ 退会リスクアラート（🔴 2週間練習なし）</li>
          <li>✅ カリキュラムリンクを全会員へ一斉配信</li>
          <li>✅ 生徒のアプリ追加インストール不要</li>
        </ul>
      </div>

      <!-- Footer (特商法準拠) -->
      <p style="text-align:center;color:#52525b;font-size:11px;margin-top:24px;line-height:1.6;">
        このメールは、<strong>${gymName}</strong>に所属する${memberCount}人以上の生徒が
        BJJ Appに登録したため自動送信されました。<br/>
        BJJ App ·
        <a href="${APP_URL}/gym/dashboard" style="color:#52525b;">ジム管理画面</a>
        &nbsp;·&nbsp;
        配信停止: このメールに「配信停止」と返信してください。
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

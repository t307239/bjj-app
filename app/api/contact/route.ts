/**
 * POST /api/contact
 *
 * z255oo: Contact form / bug report endpoint.
 *
 * - Public endpoint (no auth required) — anyone can submit
 * - Rate limited (5 submissions per IP per 10 min)
 * - Zod validation on body shape
 * - Sends email to OWNER_EMAIL via Resend
 * - Logs all submissions for monitoring
 *
 * Body shape:
 *   {
 *     name?: string (max 100, optional)
 *     email: string (required, valid email)
 *     category: "bug" | "feature" | "question" | "other"
 *     message: string (required, max 5000)
 *     pageContext?: string (max 500, optional — URL/page where form was opened)
 *     userAgent?: string (max 500, optional)
 *   }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { createRateLimiter } from "@/lib/rateLimit";

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@bjj-app.net";
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "307239t777@gmail.com";

// Rate limit: 5 per IP per 10 min — stricter than gym-waitlist (5/10min)
// because contact form is more spam-prone than waitlist signup
const contactLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

const ContactBodySchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email("有効なメールアドレスを入力してください").max(320),
  category: z.enum(["bug", "feature", "question", "other"]),
  message: z.string().min(10, "10 文字以上入力してください").max(5000),
  pageContext: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
});

const CATEGORY_LABEL: Record<string, string> = {
  bug: "🐛 バグ報告",
  feature: "💡 機能リクエスト",
  question: "❓ 質問",
  other: "📩 その他",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!contactLimiter.check(ip)) {
    return NextResponse.json(
      { error: "お問い合わせは 10 分に 5 件までです。少し時間を置いてください。" },
      { status: 429 },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ContactBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "入力内容を確認してください" },
      { status: 400 },
    );
  }

  const { name, email, category, message, pageContext, userAgent } =
    parsed.data;

  // Log submission (no PII beyond what user explicitly provided)
  logger.info("contact.submission", {
    category,
    has_name: !!name,
    has_pageContext: !!pageContext,
    message_length: message.length,
    ip_hash: ip.length,  // length-only for privacy
  });

  if (!RESEND_API_KEY) {
    logger.error(
      "contact.no_resend_key",
      {},
      new Error("RESEND_API_KEY missing"),
    );
    return NextResponse.json(
      { error: "メール送信が一時的に利用できません。後ほど再度お試しください。" },
      { status: 503 },
    );
  }

  const subject = `[BJJ App] ${CATEGORY_LABEL[category]}: ${message
    .slice(0, 60)
    .replace(/[\r\n]+/g, " ")}`;

  const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"></head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 24px auto; padding: 0 16px; color: #1f2937;">
  <h2 style="font-size: 18px; border-bottom: 2px solid #10b981; padding-bottom: 8px;">
    ${escapeHtml(CATEGORY_LABEL[category])}
  </h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
    <tr><td style="padding: 6px 0; color: #6b7280; width: 100px;">From</td>
        <td>${escapeHtml(name || "(名前なし)")} &lt;${escapeHtml(email)}&gt;</td></tr>
    <tr><td style="padding: 6px 0; color: #6b7280;">Category</td>
        <td>${escapeHtml(category)}</td></tr>
    ${
      pageContext
        ? `<tr><td style="padding: 6px 0; color: #6b7280;">Page</td>
             <td><code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;">${escapeHtml(pageContext)}</code></td></tr>`
        : ""
    }
    ${
      userAgent
        ? `<tr><td style="padding: 6px 0; color: #6b7280;">UA</td>
             <td style="font-size:12px;color:#9ca3af;">${escapeHtml(userAgent.slice(0, 200))}</td></tr>`
        : ""
    }
  </table>
  <div style="background: #f9fafb; border-left: 3px solid #10b981; padding: 16px; border-radius: 4px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">
${escapeHtml(message)}
  </div>
  <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
    Reply 直接で返信可能です (To: ${escapeHtml(email)})
  </p>
</body></html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: OWNER_EMAIL,
        reply_to: email,  // owner can reply directly to user
        subject,
        html,
        tags: [
          { name: "type", value: "contact_form" },
          { name: "category", value: category },
        ],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      logger.error(
        "contact.resend_failed",
        { status: res.status, body: errBody.slice(0, 300) },
        new Error(`Resend HTTP ${res.status}`),
      );
      return NextResponse.json(
        { error: "送信に失敗しました。時間をおいて再度お試しください。" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    logger.error(
      "contact.send_error",
      {},
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { error: "送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}

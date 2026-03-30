/**
 * POST /api/ai-coach/generate
 *
 * Generates a personalized AI coaching insight for the authenticated Pro user
 * based on their last 30 days of training data. Caches result in profiles table.
 * Rate-limited to 1 generation per 7 days per user.
 *
 * Returns: { coaching: string, generated_at: string, from_cache: boolean }
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY — Claude API key (graceful no-op if missing)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ── Rate limit: AI generation — max 5 per IP per hour (abuse protection) ──
const aiRateMap = new Map<string, { count: number; resetAt: number }>();
function checkAIRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = aiRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    aiRateMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  entry.count++;
  return entry.count <= 5;
}

async function callAnthropicAPI(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      logger.warn("ai_coach.anthropic_api_error", { status: res.status });
      return null;
    }

    const data = await res.json() as {
      content?: Array<{ type: string; text: string }>;
    };
    return data.content?.[0]?.text ?? null;
  } catch (err) {
    logger.error("ai_coach.anthropic_fetch_error", {}, err as Error);
    return null;
  }
}

function buildCoachingPrompt(stats: {
  totalSessions: number;
  weeklyAvg: number;
  giSessions: number;
  nogiSessions: number;
  drillingSessions: number;
  competitionSessions: number;
  recoverySessions: number;
  streakDays: number;
  belt: string;
  stripes: number;
}): string {
  const beltLabel = `${stats.belt} belt${stats.stripes > 0 ? ` (${stats.stripes} stripe${stats.stripes > 1 ? "s" : ""})` : ""}`;

  return `You are a concise, encouraging BJJ coach. Analyze this student's training data and give them personalized coaching.

Student: ${beltLabel}
Last 30 days of training:
- Total sessions: ${stats.totalSessions}
- Weekly average: ${stats.weeklyAvg.toFixed(1)} sessions/week
- Gi sessions: ${stats.giSessions}
- No-Gi sessions: ${stats.nogiSessions}
- Drilling sessions: ${stats.drillingSessions}
- Competition sessions: ${stats.competitionSessions}
- Recovery/open mat: ${stats.recoverySessions}
- Current streak: ${stats.streakDays} days

Give a response in this EXACT format (3 sections, no markdown headers, just the text):

INSIGHT: [1-2 sentences observing a pattern in their training — specific, data-driven, encouraging]

TIPS:
• [Tip 1: specific actionable advice based on their data]
• [Tip 2: specific actionable advice]
• [Tip 3: specific actionable advice]

CHALLENGE: [One concrete challenge for them to try this week — measurable and BJJ-specific]

Keep the entire response under 180 words. Be direct and specific. Address them as "you".`;
}

function buildFallbackCoaching(stats: {
  totalSessions: number;
  weeklyAvg: number;
  belt: string;
}): string {
  if (stats.totalSessions === 0) {
    return `INSIGHT: Your mat journey starts with a single step — every elite competitor was once exactly where you are.\n\nTIPS:\n• Set a target of 2 sessions this week to build the habit\n• Focus on one position per session rather than trying to learn everything\n• Log each session to track your progress over time\n\nCHALLENGE: Get to the mat for your first training session this week and log it in the app.`;
  }
  if (stats.weeklyAvg >= 3) {
    return `INSIGHT: Training ${stats.weeklyAvg.toFixed(1)}x per week puts you in the top tier of dedicated practitioners — consistency is your superpower.\n\nTIPS:\n• At this frequency, recovery is as important as training — prioritize sleep and mobility work\n• Identify one specific position you want to master this month\n• Consider adding drilling sessions to complement live rolling\n\nCHALLENGE: This week, pick one submission or position to drill for 10 minutes at the start of every session.`;
  }
  return `INSIGHT: You logged ${stats.totalSessions} sessions this month — every session on the mat compounds your progress.\n\nTIPS:\n• Aim for ${Math.min(stats.totalSessions + 2, 12)} sessions next month to level up your consistency\n• On days you can't train full sessions, even 20 minutes of drilling counts\n• Review your technique notes after each session to reinforce learning\n\nCHALLENGE: Schedule your next 3 training sessions in your calendar right now — treat them as unmissable appointments.`;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkAIRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch profile — check Pro status and cached coaching
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_pro, belt, stripe, ai_coach_cache, ai_coach_last_generated")
    .eq("id", user.id)
    .single();

  if (!profile?.is_pro) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  // Check cache freshness (7 days)
  const lastGenerated = profile.ai_coach_last_generated
    ? new Date(profile.ai_coach_last_generated).getTime()
    : 0;
  const cacheAge = Date.now() - lastGenerated;

  if (profile.ai_coach_cache && cacheAge < SEVEN_DAYS_MS) {
    return NextResponse.json({
      coaching: profile.ai_coach_cache,
      generated_at: profile.ai_coach_last_generated,
      from_cache: true,
    });
  }

  // Fetch last 30 days of training data
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: logs } = await supabase
    .from("training_logs")
    .select("type, date, duration_min")
    .eq("user_id", user.id)
    .gte("date", thirtyDaysAgo);

  const sessions = logs ?? [];

  // Compute stats
  const totalSessions = sessions.length;
  const weeklyAvg = totalSessions / 4.3;
  const typeCount = (type: string) => sessions.filter((s) => s.type === type).length;

  const stats = {
    totalSessions,
    weeklyAvg,
    giSessions: typeCount("gi"),
    nogiSessions: typeCount("nogi"),
    drillingSessions: typeCount("drilling"),
    competitionSessions: typeCount("competition"),
    recoverySessions: typeCount("recovery") + typeCount("open_mat"),
    streakDays: 0, // simplified — streak computed client-side
    belt: profile.belt ?? "white",
    stripes: profile.stripe ?? 0,
  };

  // Try Anthropic API first, fall back to rule-based
  let coaching: string | null = null;

  if (process.env.ANTHROPIC_API_KEY) {
    const prompt = buildCoachingPrompt(stats);
    coaching = await callAnthropicAPI(prompt);
  }

  if (!coaching) {
    coaching = buildFallbackCoaching(stats);
  }

  // Attempt to cache in DB (graceful if columns don't exist yet)
  const now = new Date().toISOString();
  try {
    await supabase
      .from("profiles")
      .update({
        ai_coach_cache: coaching,
        ai_coach_last_generated: now,
      })
      .eq("id", user.id);
  } catch {
    // Columns may not exist yet — cache miss is OK
  }

  return NextResponse.json({
    coaching,
    generated_at: now,
    from_cache: false,
  });
}

/**
 * POST /api/ai-coach/generate
 *
 * Generates a personalized AI coaching insight for the authenticated Pro user
 * based on their training data. Supports multiple coaching modes:
 *   - "general"     — Weekly insight + tips + challenge (default)
 *   - "weakness"    — Weakness analysis based on training gaps
 *   - "next_session"— Next training session recommendation
 *   - "comp_prep"   — Pre-competition advice based on training & comp record
 *
 * Caches result in profiles table. Rate-limited to 1 generation per 7 days per mode.
 *
 * Returns: { coaching: string, generated_at: string, from_cache: boolean, mode: string }
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY — Claude API key (graceful no-op if missing)
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const VALID_MODES = ["general", "weakness", "next_session", "comp_prep"] as const;
type CoachMode = typeof VALID_MODES[number];

import { createRateLimiter } from "@/lib/rateLimit";

// ── Rate limit: AI generation — max 5 per IP per hour ──
const aiLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

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
        max_tokens: 600,
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

const LOCALE_INSTRUCTIONS: Record<string, string> = {
  ja: "Respond entirely in Japanese (日本語で返答してください).",
  pt: "Respond entirely in Brazilian Portuguese (Responda completamente em português brasileiro).",
  en: "",
};

// ── Shared stats type ──
type CoachStats = {
  totalSessions: number;
  weeklyAvg: number;
  giSessions: number;
  nogiSessions: number;
  drillingSessions: number;
  competitionSessions: number;
  recoverySessions: number;
  openMatSessions: number;
  streakDays: number;
  belt: string;
  stripes: number;
  locale: string;
  // Extended data for enhanced modes
  techniques?: { name: string; category: string; mastery_level: number }[];
  compRecords?: { result: string; finish: string; opponent_rank: string }[];
  avgDurationMin?: number;
  topTechniqueCategories?: string[];
  daysSinceLastSession?: number;
};

// ── Mode-specific prompt builders ──

function buildGeneralPrompt(stats: CoachStats): string {
  const beltLabel = `${stats.belt} belt${stats.stripes > 0 ? ` (${stats.stripes} stripe${stats.stripes > 1 ? "s" : ""})` : ""}`;
  const localeInstruction = LOCALE_INSTRUCTIONS[stats.locale] ?? "";

  return `You are a concise, encouraging BJJ coach. Analyze this student's training data and give them personalized coaching.${localeInstruction ? ` ${localeInstruction}` : ""}

Student: ${beltLabel}
Last 30 days of training:
- Total sessions: ${stats.totalSessions}
- Weekly average: ${stats.weeklyAvg.toFixed(1)} sessions/week
- Gi sessions: ${stats.giSessions}
- No-Gi sessions: ${stats.nogiSessions}
- Drilling sessions: ${stats.drillingSessions}
- Competition sessions: ${stats.competitionSessions}
- Recovery/open mat: ${stats.recoverySessions + stats.openMatSessions}
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

function buildWeaknessPrompt(stats: CoachStats): string {
  const beltLabel = `${stats.belt} belt${stats.stripes > 0 ? ` (${stats.stripes} stripe${stats.stripes > 1 ? "s" : ""})` : ""}`;
  const localeInstruction = LOCALE_INSTRUCTIONS[stats.locale] ?? "";

  const techniqueSection = stats.techniques && stats.techniques.length > 0
    ? `\nTechniques tracked (name / category / mastery 1-5):\n${stats.techniques.slice(0, 20).map(t => `- ${t.name} (${t.category}) — mastery ${t.mastery_level}/5`).join("\n")}`
    : "\nNo techniques tracked yet.";

  return `You are an analytical BJJ coach specializing in identifying training gaps. ${localeInstruction}

Student: ${beltLabel}
Last 30 days:
- Total sessions: ${stats.totalSessions} (weekly avg: ${stats.weeklyAvg.toFixed(1)})
- Gi: ${stats.giSessions}, No-Gi: ${stats.nogiSessions}, Drilling: ${stats.drillingSessions}
- Competition: ${stats.competitionSessions}, Open Mat: ${stats.openMatSessions}, Recovery: ${stats.recoverySessions}
${techniqueSection}

Analyze their training GAPS and WEAKNESSES. Give a response in this EXACT format:

ANALYSIS: [2-3 sentences identifying the biggest training gap or imbalance — be specific and data-driven, not generic]

WEAKNESSES:
• [Weakness 1: specific area they're neglecting with evidence from the data]
• [Weakness 2: another gap or imbalance]
• [Weakness 3: a skill area common for their belt level they should develop]

PLAN: [A concrete 2-week plan to address the #1 weakness — include specific drills or positions to practice]

Keep under 200 words. Be honest but constructive. This is a gap analysis, not cheerleading.`;
}

function buildNextSessionPrompt(stats: CoachStats): string {
  const beltLabel = `${stats.belt} belt${stats.stripes > 0 ? ` (${stats.stripes} stripe${stats.stripes > 1 ? "s" : ""})` : ""}`;
  const localeInstruction = LOCALE_INSTRUCTIONS[stats.locale] ?? "";

  const lastSessionInfo = stats.daysSinceLastSession !== undefined
    ? `\nDays since last session: ${stats.daysSinceLastSession}`
    : "";

  const techniqueSection = stats.techniques && stats.techniques.length > 0
    ? `\nLow-mastery techniques: ${stats.techniques.filter(t => t.mastery_level <= 2).slice(0, 8).map(t => `${t.name}(${t.category})`).join(", ") || "None"}`
    : "";

  return `You are a practical BJJ training planner. Based on this student's recent data, recommend what they should focus on in their NEXT training session. ${localeInstruction}

Student: ${beltLabel}
Last 30 days: ${stats.totalSessions} sessions (Gi:${stats.giSessions} NoGi:${stats.nogiSessions} Drill:${stats.drillingSessions})
Avg session duration: ${stats.avgDurationMin ?? 60}min${lastSessionInfo}${techniqueSection}

Give a response in this EXACT format:

FOCUS: [One clear focus area for their next session — specific position or technique, not vague]

WARMUP:
• [Specific warmup drill 1 — with duration]
• [Specific warmup drill 2 — with duration]

DRILL:
• [Main technique drill — with reps/duration and specific details]
• [Variation or counter drill — with reps/duration]

SPARRING: [How to approach sparring this session — positional or flow roll recommendation, specific goals]

Keep under 180 words. Be extremely specific — name actual BJJ positions and techniques.`;
}

function buildCompPrepPrompt(stats: CoachStats): string {
  const beltLabel = `${stats.belt} belt${stats.stripes > 0 ? ` (${stats.stripes} stripe${stats.stripes > 1 ? "s" : ""})` : ""}`;
  const localeInstruction = LOCALE_INSTRUCTIONS[stats.locale] ?? "";

  const compSection = stats.compRecords && stats.compRecords.length > 0
    ? `\nRecent competition results:\n${stats.compRecords.slice(0, 10).map(c => `- ${c.result}${c.finish ? ` by ${c.finish}` : ""}${c.opponent_rank ? ` vs ${c.opponent_rank}` : ""}`).join("\n")}`
    : "\nNo competition records yet.";

  return `You are a BJJ competition preparation coach. Help this student prepare for their next competition. ${localeInstruction}

Student: ${beltLabel}
Last 30 days training: ${stats.totalSessions} sessions
- Gi: ${stats.giSessions}, No-Gi: ${stats.nogiSessions}
- Drilling: ${stats.drillingSessions}, Competition training: ${stats.competitionSessions}${compSection}

Give a response in this EXACT format:

ASSESSMENT: [2 sentences on their competition readiness based on training volume and mix]

GAMEPLAN:
• [Takedown strategy — specific technique recommendation]
• [Top game plan — specific passes and positions]
• [Bottom game plan — specific guards and sweeps]
• [Submission chain — 2-3 connected submissions to drill]

WEEK_BEFORE: [Specific advice for the final week: training intensity, weight management, mental prep — 2-3 sentences]

Keep under 200 words. Be strategic and specific. Name actual techniques.`;
}

// ── Fallback generators (when API key is missing or fails) ──

function buildFallbackCoaching(stats: CoachStats, mode: CoachMode): string {
  const loc = stats.locale;

  if (mode === "weakness") {
    return buildFallbackWeakness(stats, loc);
  }
  if (mode === "next_session") {
    return buildFallbackNextSession(stats, loc);
  }
  if (mode === "comp_prep") {
    return buildFallbackCompPrep(stats, loc);
  }
  return buildFallbackGeneral(stats, loc);
}

function buildFallbackGeneral(stats: CoachStats, loc: string): string {
  if (loc === "ja") {
    if (stats.totalSessions === 0) {
      return `INSIGHT: 道場への第一歩が全ての始まり。世界のトップ選手も、かつてあなたと同じ場所にいました。\n\nTIPS:\n• まずは今週2回の練習を目標に設定しましょう\n• 1回の練習で1つのポジションに集中することが上達の近道です\n• 毎回の練習をアプリに記録して成長を可視化しましょう\n\nCHALLENGE: 今週、最初のスパーリングセッションに参加してアプリに記録してください。`;
    }
    if (stats.weeklyAvg >= 3) {
      return `INSIGHT: 週${stats.weeklyAvg.toFixed(1)}回の練習頻度は上位の継続力です。一貫性があなたの最大の武器です。\n\nTIPS:\n• この頻度では回復も練習と同じくらい重要。睡眠とモビリティを優先してください\n• 今月マスターしたい特定のポジションを1つ決めましょう\n• スパーリングに加え、ドリルセッションの追加を検討してください\n\nCHALLENGE: 今週の毎練習開始時に、1つのサブミッションまたはポジションを10分間ドリルしてください。`;
    }
    return `INSIGHT: 今月${stats.totalSessions}回練習しました。道場での1回1回が積み重なって確実な成長になります。\n\nTIPS:\n• 来月は${Math.min(stats.totalSessions + 2, 12)}回を目標に一貫性を高めましょう\n• フル練習に参加できない日でも、20分のドリルだけでも価値があります\n• 各セッション後に技術メモを見直し、学びを定着させましょう\n\nCHALLENGE: 今すぐ次の3回の練習をカレンダーに入れて、絶対に外せない予定として扱ってください。`;
  }
  // English (default)
  if (stats.totalSessions === 0) {
    return `INSIGHT: Your mat journey starts with a single step — every elite competitor was once exactly where you are.\n\nTIPS:\n• Set a target of 2 sessions this week to build the habit\n• Focus on one position per session rather than trying to learn everything\n• Log each session to track your progress over time\n\nCHALLENGE: Get to the mat for your first training session this week and log it in the app.`;
  }
  if (stats.weeklyAvg >= 3) {
    return `INSIGHT: Training ${stats.weeklyAvg.toFixed(1)}x per week puts you in the top tier of dedicated practitioners — consistency is your superpower.\n\nTIPS:\n• At this frequency, recovery is as important as training — prioritize sleep and mobility work\n• Identify one specific position you want to master this month\n• Consider adding drilling sessions to complement live rolling\n\nCHALLENGE: This week, pick one submission or position to drill for 10 minutes at the start of every session.`;
  }
  return `INSIGHT: You logged ${stats.totalSessions} sessions this month — every session on the mat compounds your progress.\n\nTIPS:\n• Aim for ${Math.min(stats.totalSessions + 2, 12)} sessions next month to level up your consistency\n• On days you can't train full sessions, even 20 minutes of drilling counts\n• Review your technique notes after each session to reinforce learning\n\nCHALLENGE: Schedule your next 3 training sessions in your calendar right now — treat them as unmissable appointments.`;
}

function buildFallbackWeakness(stats: CoachStats, loc: string): string {
  const drillRatio = stats.totalSessions > 0 ? stats.drillingSessions / stats.totalSessions : 0;
  const giRatio = stats.totalSessions > 0 ? stats.giSessions / stats.totalSessions : 0;

  if (loc === "ja") {
    const weaknesses: string[] = [];
    if (drillRatio < 0.2) weaknesses.push("ドリリングの割合が低い（全体の" + Math.round(drillRatio * 100) + "%）。技術定着にはスパーリングだけでは不十分です");
    if (giRatio > 0.8 && stats.totalSessions >= 4) weaknesses.push("道衣に偏りすぎ。ノーギも取り入れてグリップ依存を減らしましょう");
    if (giRatio < 0.2 && stats.totalSessions >= 4) weaknesses.push("ノーギに偏りすぎ。道衣練習で緻密なポジショニングを鍛えましょう");
    if (stats.competitionSessions === 0 && stats.totalSessions >= 8) weaknesses.push("試合練習が0回。大会に出る予定があるならコンペクラスに参加を");
    if (weaknesses.length === 0) weaknesses.push("現時点ではバランスの取れた練習ができています。さらなる向上には練習頻度を上げることを検討してください");

    return `ANALYSIS: 過去30日間のデータを分析しました。${stats.totalSessions}回のセッションから、改善すべきポイントが見えてきます。\n\nWEAKNESSES:\n${weaknesses.map(w => "• " + w).join("\n")}\n\nPLAN: 次の2週間、毎回の練習開始時に15分間のテクニックドリルを追加してください。特にガードリテンションとスイープの反復を重点的に。`;
  }
  const weaknesses: string[] = [];
  if (drillRatio < 0.2) weaknesses.push(`Drilling ratio is low (${Math.round(drillRatio * 100)}% of sessions). Sparring alone won't build technique retention`);
  if (giRatio > 0.8 && stats.totalSessions >= 4) weaknesses.push("Heavy Gi bias. Add No-Gi to reduce grip dependency and develop wrestling");
  if (giRatio < 0.2 && stats.totalSessions >= 4) weaknesses.push("Heavy No-Gi bias. Gi training builds precise positioning and grip fighting skills");
  if (stats.competitionSessions === 0 && stats.totalSessions >= 8) weaknesses.push("Zero competition training. If you plan to compete, add comp-specific sessions");
  if (weaknesses.length === 0) weaknesses.push("Your training mix is reasonably balanced. Consider increasing frequency for faster improvement");

  return `ANALYSIS: Analyzing your ${stats.totalSessions} sessions over 30 days reveals clear areas for improvement.\n\nWEAKNESSES:\n${weaknesses.map(w => "• " + w).join("\n")}\n\nPLAN: For the next 2 weeks, add 15 minutes of focused technique drilling at the start of every session. Prioritize guard retention and sweep mechanics.`;
}

function buildFallbackNextSession(stats: CoachStats, loc: string): string {
  const lastType = stats.giSessions >= stats.nogiSessions ? "No-Gi" : "Gi";

  if (loc === "ja") {
    return `FOCUS: ${lastType === "No-Gi" ? "ノーギ" : "道衣"}で普段と違う刺激を。ハーフガードからのスイープに集中しましょう。\n\nWARMUP:\n• ヒップエスケープ往復 × 3分\n• テクニカルスタンドアップ × 2分\n\nDRILL:\n• ハーフガードからのアンダーフックスイープ × 各サイド10回\n• ニーシールドからのリカバリー → フルガードへの移行 × 各サイド8回\n\nSPARRING: ポジショナルスパー推奨。ハーフガードからスタートし、スイープまたはフルガードリカバリーを目標に。`;
  }
  return `FOCUS: Switch to ${lastType} for variety. Concentrate on half guard sweeps today.\n\nWARMUP:\n• Hip escapes across the mat × 3 min\n• Technical stand-ups × 2 min\n\nDRILL:\n• Underhook sweep from half guard × 10 reps each side\n• Knee shield recovery to full guard × 8 reps each side\n\nSPARRING: Positional sparring recommended. Start from half guard — goal is either sweep or recovery to full guard.`;
}

function buildFallbackCompPrep(stats: CoachStats, loc: string): string {
  const wins = stats.compRecords?.filter(c => c.result === "win").length ?? 0;
  const total = stats.compRecords?.length ?? 0;

  if (loc === "ja") {
    return `ASSESSMENT: ${stats.totalSessions}回の直近練習と${total > 0 ? total + "試合の経験" : "試合経験なし"}。${stats.drillingSessions >= 3 ? "ドリリング量は十分" : "ドリリングを増やして技の精度を上げましょう"}。\n\nGAMEPLAN:\n• テイクダウン: シングルレッグ → ダブルレッグの二択を確実に。引き込みも選択肢として準備\n• トップ: ニースライスパス → サイドコントロール → マウントの流れを反復\n• ボトム: クローズドガード → ヒップバンプスイープ → 三角絞めのコンビネーション\n• サブミッション: 三角絞め → 腕十字 → キムラのチェーンを身体に覚えさせる\n\nWEEK_BEFORE: 大会5日前から強度を落とし、テクニックドリルのみに。計量がある場合は3日前から水分・食事管理開始。前日は軽いムーブメントと早めの就寝を。`;
  }
  return `ASSESSMENT: ${stats.totalSessions} recent sessions and ${total > 0 ? total + " comp matches" : "no comp experience yet"}. ${stats.drillingSessions >= 3 ? "Drilling volume is solid" : "Increase drilling to sharpen technique precision"}.\n\nGAMEPLAN:\n• Takedown: Single leg → double leg combo. Also prepare guard pull as backup\n• Top: Knee slice pass → side control → mount transition chain\n• Bottom: Closed guard → hip bump sweep → triangle setup\n• Submissions: Triangle → armbar → kimura chain — drill until automatic\n\nWEEK_BEFORE: Reduce intensity 5 days out, drill-only sessions. If cutting weight, start water/diet management 3 days before. Light movement and early sleep the night before.`;
}

// ── Main handler ──

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!aiLimiter.check(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as { locale?: string; mode?: string };
  const locale = (["en", "ja", "pt"].includes(body.locale ?? "")) ? (body.locale ?? "en") : "en";
  const mode = (VALID_MODES.includes(body.mode as CoachMode) ? body.mode : "general") as CoachMode;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch profile — check Pro status and cached coaching
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_pro, belt, stripe, ai_coach_cache, ai_coach_last_generated")
    .eq("id", user.id)
    .single();
  if (profileError) {
    logger.error("ai_coach.profile_query", { userId: user.id }, profileError as Error);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile?.is_pro) {
    return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });
  }

  // Parse multi-mode cache: { general: { text, at }, weakness: { text, at }, ... }
  type CacheEntry = { text: string; at: string };
  type CacheMap = Partial<Record<CoachMode, CacheEntry>>;
  let cacheMap: CacheMap = {};
  try {
    if (profile.ai_coach_cache) {
      const parsed = JSON.parse(profile.ai_coach_cache);
      // Backwards compat: old cache was plain string (general mode)
      if (typeof parsed === "string") {
        cacheMap = { general: { text: parsed, at: profile.ai_coach_last_generated ?? "" } };
      } else {
        cacheMap = parsed as CacheMap;
      }
    }
  } catch {
    // Invalid cache — regenerate
  }

  // Check cache freshness for this specific mode
  const cachedMode = cacheMap[mode];
  if (cachedMode) {
    const cacheAge = Date.now() - new Date(cachedMode.at).getTime();
    if (cacheAge < SEVEN_DAYS_MS) {
      return NextResponse.json({
        coaching: cachedMode.text,
        generated_at: cachedMode.at,
        from_cache: true,
        mode,
      });
    }
  }

  // Fetch last 30 days of training data
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Parallel data fetch for enhanced modes
  const [logsRes, techniquesRes] = await Promise.all([
    supabase
      .from("training_logs")
      .select("type, date, duration_min, notes")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo),
    (mode === "weakness" || mode === "next_session" || mode === "comp_prep")
      ? supabase
          .from("techniques")
          .select("name, category, mastery_level")
          .eq("user_id", user.id)
          .order("mastery_level", { ascending: true })
          .limit(30)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (logsRes.error) {
    logger.error("ai_coach.training_logs_query", { userId: user.id }, logsRes.error as Error);
    return NextResponse.json({ error: logsRes.error.message }, { status: 500 });
  }

  const sessions = logsRes.data ?? [];

  // Compute stats
  const totalSessions = sessions.length;
  const weeklyAvg = totalSessions / 4.3;
  const typeCount = (type: string) => sessions.filter((s) => s.type === type).length;
  const durations = sessions.filter(s => s.duration_min && s.duration_min > 0).map(s => s.duration_min);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 60;

  // Extract comp records from competition-type notes
  const compRecords: { result: string; finish: string; opponent_rank: string }[] = [];
  for (const s of sessions) {
    if (s.type === "competition" && s.notes && s.notes.startsWith("__COMP__")) {
      try {
        const jsonStr = s.notes.includes("\n")
          ? s.notes.slice(8, s.notes.indexOf("\n"))
          : s.notes.slice(8);
        const comp = JSON.parse(jsonStr);
        compRecords.push({
          result: comp.result ?? "",
          finish: comp.finish ?? "",
          opponent_rank: comp.opponent_rank ?? "",
        });
      } catch { /* skip malformed */ }
    }
  }

  // Days since last session
  const sortedDates = sessions.map(s => s.date).sort().reverse();
  const daysSinceLastSession = sortedDates.length > 0
    ? Math.round((Date.now() - new Date(sortedDates[0] + "T00:00:00Z").getTime()) / 86400000)
    : undefined;

  const stats: CoachStats = {
    totalSessions,
    weeklyAvg,
    giSessions: typeCount("gi"),
    nogiSessions: typeCount("nogi"),
    drillingSessions: typeCount("drilling"),
    competitionSessions: typeCount("competition"),
    recoverySessions: typeCount("recovery"),
    openMatSessions: typeCount("open_mat"),
    streakDays: 0,
    belt: profile.belt ?? "white",
    stripes: profile.stripe ?? 0,
    locale,
    techniques: (techniquesRes.data ?? []) as { name: string; category: string; mastery_level: number }[],
    compRecords,
    avgDurationMin: avgDuration,
    daysSinceLastSession,
  };

  // Build prompt based on mode
  let prompt: string;
  switch (mode) {
    case "weakness":
      prompt = buildWeaknessPrompt(stats);
      break;
    case "next_session":
      prompt = buildNextSessionPrompt(stats);
      break;
    case "comp_prep":
      prompt = buildCompPrepPrompt(stats);
      break;
    default:
      prompt = buildGeneralPrompt(stats);
  }

  // Try Anthropic API first, fall back to rule-based
  let coaching: string | null = null;

  if (process.env.ANTHROPIC_API_KEY) {
    coaching = await callAnthropicAPI(prompt);
  }

  if (!coaching) {
    coaching = buildFallbackCoaching(stats, mode);
  }

  // Update multi-mode cache in DB
  const now = new Date().toISOString();
  cacheMap[mode] = { text: coaching, at: now };
  try {
    await supabase
      .from("profiles")
      .update({
        ai_coach_cache: JSON.stringify(cacheMap),
        ai_coach_last_generated: now,
      })
      .eq("id", user.id);
  } catch {
    // Columns may not exist yet — cache miss is OK
  }

  revalidatePath("/dashboard");

  return NextResponse.json({
    coaching,
    generated_at: now,
    from_cache: false,
    mode,
  });
}

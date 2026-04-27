import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BELT_COLORS: Record<string, { bg: string; text: string; label: string; labelEn: string }> = {
  white:  { bg: "#f3f4f6", text: "#111827", label: "白帯",  labelEn: "White Belt" },
  blue:   { bg: "#1d4ed8", text: "#ffffff", label: "青帯",  labelEn: "Blue Belt" },
  purple: { bg: "#7e22ce", text: "#ffffff", label: "紫帯",  labelEn: "Purple Belt" },
  brown:  { bg: "#92400e", text: "#ffffff", label: "茶帯",  labelEn: "Brown Belt" },
  black:  { bg: "#111827", text: "#ffffff", label: "黒帯",  labelEn: "Black Belt" },
};

// z195 (F-1): locale-aware tagline + mode-based copy variant
// z222: + "achievement" mode for viral share cards (streak / sessions / belt)
type Mode = "user" | "lp" | "wiki" | "reddit" | "achievement";
type Lang = "ja" | "en" | "pt";

// z222: Achievement type configuration for share card layout
type AchievementType = "streak" | "sessions" | "belt" | "hours";
const ACHIEVEMENT_CONFIG: Record<
  AchievementType,
  { emoji: string; gradient: [string, string, string]; labels: Record<Lang, string> }
> = {
  streak: {
    emoji: "🔥",
    gradient: ["#7c2d12", "#b45309", "#d97706"], // orange-red flame
    labels: {
      en: "Day Streak",
      ja: "連続日数",
      pt: "Dias seguidos",
    },
  },
  sessions: {
    emoji: "💪",
    gradient: ["#064e3b", "#065f46", "#047857"], // emerald
    labels: {
      en: "Sessions Logged",
      ja: "練習記録",
      pt: "Sessões registradas",
    },
  },
  belt: {
    emoji: "🥋",
    gradient: ["#1e3a8a", "#1e40af", "#1d4ed8"], // blue (overridden by belt color)
    labels: {
      en: "Belt Promotion",
      ja: "昇帯",
      pt: "Promoção de faixa",
    },
  },
  hours: {
    emoji: "⏱",
    gradient: ["#581c87", "#6b21a8", "#7e22ce"], // purple
    labels: {
      en: "Hours on the Mat",
      ja: "練習時間",
      pt: "Horas no tatame",
    },
  },
};

const ACHIEVEMENT_TAGLINE: Record<Lang, string> = {
  en: "Tracked on bjj-app.net · indie blue belt project",
  ja: "bjj-app.net で記録 · 個人開発の柔術プロジェクト",
  pt: "Registrado em bjj-app.net · projeto indie de BJJ",
};

const TAGLINES: Record<Mode, Record<Lang, string>> = {
  user: {
    en: "Track Your BJJ Journey",
    ja: "あなたのBJJを記録",
    pt: "Acompanhe sua jornada no BJJ",
  },
  lp: {
    en: "The free BJJ training tracker",
    ja: "無料のBJJ練習トラッカー",
    pt: "O rastreador grátis de treino de BJJ",
  },
  wiki: {
    en: "BJJ encyclopedia + free training tracker",
    ja: "BJJ百科事典 + 無料練習トラッカー",
    pt: "Enciclopédia de BJJ + rastreador grátis",
  },
  reddit: {
    // z195: indie signal for Reddit / community
    en: "Built by a blue belt — track every roll, free",
    ja: "青帯が作った — ロール全部記録、無料",
    pt: "Feito por um faixa azul — registre cada rola, grátis",
  },
};

const STAT_LABELS: Record<Lang, { sessions: string; streak: string; bjjAge: string }> = {
  en: { sessions: "Sessions", streak: "Day Streak", bjjAge: "Months of BJJ" },
  ja: { sessions: "セッション", streak: "連続日数", bjjAge: "BJJ歴 (月)" },
  pt: { sessions: "Sessões", streak: "Dias seguidos", bjjAge: "Meses de BJJ" },
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const belt   = searchParams.get("belt")   ?? "white";
  const streak = searchParams.get("streak") ?? "0";
  const count  = searchParams.get("count")  ?? "0";
  const months = searchParams.get("months") ?? "0";
  // z195: mode + sub (override tagline) + lang
  // z222: + "achievement" mode for share cards
  const modeParam = (searchParams.get("mode") ?? "user") as Mode;
  const mode: Mode = ["user", "lp", "wiki", "reddit", "achievement"].includes(modeParam) ? modeParam : "user";
  const langParam = (searchParams.get("lang") ?? "en") as Lang;
  const lang: Lang = ["ja", "en", "pt"].includes(langParam) ? langParam : "en";
  const subOverride = searchParams.get("sub")?.slice(0, 80) ?? null; // 80 char limit

  // ── z222: Achievement card branch (early return) ─────────────────
  if (mode === "achievement") {
    const typeParam = (searchParams.get("type") ?? "streak") as AchievementType;
    const aType: AchievementType = ["streak", "sessions", "belt", "hours"].includes(typeParam)
      ? typeParam
      : "streak";
    const value = (searchParams.get("value") ?? "0").slice(0, 8); // numeric or short text
    const cfg = ACHIEVEMENT_CONFIG[aType];
    const beltInfoA = BELT_COLORS[belt] ?? BELT_COLORS.white;
    const beltLabelA = lang === "ja" ? beltInfoA.label : beltInfoA.labelEn;
    const aLabel = cfg.labels[lang];
    const aTagline = ACHIEVEMENT_TAGLINE[lang];

    // Belt 達成は belt color を gradient に
    const grad = aType === "belt"
      ? [beltInfoA.bg, beltInfoA.bg, beltInfoA.bg]
      : cfg.gradient;

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, ${grad[0]} 0%, ${grad[1]} 50%, ${grad[2]} 100%)`,
            padding: "56px 64px",
            fontFamily: "sans-serif",
            color: "#ffffff",
          }}
        >
          {/* Header: brand + belt */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ fontSize: "44px" }}>🥋</div>
            <div style={{ fontSize: "28px", fontWeight: "bold", letterSpacing: "-0.5px" }}>
              BJJ App
            </div>
            <div
              style={{
                marginLeft: "auto",
                backgroundColor: beltInfoA.bg,
                color: beltInfoA.text,
                borderRadius: "10px",
                padding: "6px 22px",
                fontSize: "22px",
                fontWeight: "bold",
                border: belt === "white" ? "2px solid #374151" : "none",
              }}
            >
              {beltLabelA}
            </div>
          </div>

          {/* Hero: emoji + value + label */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontSize: "120px", lineHeight: 1 }}>{cfg.emoji}</div>
            <div style={{ fontSize: "180px", fontWeight: "bold", lineHeight: 1, marginTop: "16px" }}>
              {value}
            </div>
            <div style={{ fontSize: "36px", fontWeight: "600", marginTop: "8px", opacity: 0.95, textTransform: "uppercase", letterSpacing: "2px" }}>
              {aLabel}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.9 }}>
            <div style={{ fontSize: "20px" }}>{aTagline}</div>
            <div style={{ fontSize: "20px" }}>bjj-app.net</div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }
  // ── /achievement branch ──────────────────────────────────────────


  const beltInfo = BELT_COLORS[belt] ?? BELT_COLORS.white;
  const beltLabel = lang === "ja" ? beltInfo.label : beltInfo.labelEn;
  const stats = STAT_LABELS[lang];
  const tagline = subOverride ?? TAGLINES[mode][lang];
  const labels = {
    belt: beltLabel,
    sessions: stats.sessions,
    streak: stats.streak,
    bjjAge: stats.bjjAge,
    tagline,
  };

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          backgroundColor: "#0f172a",
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ fontSize: "52px" }}>🥋</div>
          <div style={{ color: "#10B981", fontSize: "40px", fontWeight: "bold", letterSpacing: "-1px" }}>
            BJJ App
          </div>
          {/* Belt badge */}
          <div
            style={{
              backgroundColor: beltInfo.bg,
              color: beltInfo.text,
              borderRadius: "10px",
              padding: "6px 22px",
              fontSize: "24px",
              fontWeight: "bold",
              marginLeft: "auto",
              border: belt === "white" ? "2px solid #374151" : "none",
            }}
          >
            {labels.belt}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: "24px", justifyContent: "center" }}>
          {/* Sessions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "20px",
              padding: "28px 20px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#10B981", fontSize: "80px", fontWeight: "bold", lineHeight: 1 }}>
              {count}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "22px", marginTop: "10px" }}>
              {labels.sessions}
            </div>
          </div>

          {/* Streak */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "20px",
              padding: "28px 20px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#fbbf24", fontSize: "80px", fontWeight: "bold", lineHeight: 1 }}>
              {streak}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "22px", marginTop: "10px" }}>
              {labels.streak}
            </div>
          </div>

          {/* BJJ age */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "20px",
              padding: "28px 20px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#60a5fa", fontSize: "80px", fontWeight: "bold", lineHeight: 1 }}>
              {months}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "22px", marginTop: "10px" }}>
              {labels.bjjAge}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#6b7280", fontSize: "20px" }}>
            {labels.tagline}
          </div>
          <div style={{ color: "#6b7280", fontSize: "20px" }}>
            bjj-app.net
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

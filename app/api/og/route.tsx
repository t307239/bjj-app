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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const belt   = searchParams.get("belt")   ?? "white";
  const streak = searchParams.get("streak") ?? "0";
  const count  = searchParams.get("count")  ?? "0";
  const months = searchParams.get("months") ?? "0";
  const beltInfo = BELT_COLORS[belt] ?? BELT_COLORS.white;

  const labels = { belt: beltInfo.labelEn, sessions: "Sessions", streak: "Day Streak", bjjAge: "Months of BJJ", tagline: "Track Your BJJ Journey" };

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

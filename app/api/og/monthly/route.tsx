import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const BELT_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  white:  { bg: "#f3f4f6", text: "#111827", label: "White Belt" },
  blue:   { bg: "#1d4ed8", text: "#ffffff", label: "Blue Belt" },
  purple: { bg: "#7e22ce", text: "#ffffff", label: "Purple Belt" },
  brown:  { bg: "#92400e", text: "#ffffff", label: "Brown Belt" },
  black:  { bg: "#111827", text: "#ffffff", label: "Black Belt" },
};

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessions   = searchParams.get("sessions") ?? "0";
  const hours      = searchParams.get("hours") ?? "0";
  const streak     = searchParams.get("streak") ?? "0";
  const belt       = searchParams.get("belt") ?? "white";
  const monthNum   = Number(searchParams.get("month") ?? new Date().getMonth() + 1);
  const year       = searchParams.get("year") ?? String(new Date().getFullYear());
  const techniques = searchParams.get("techniques") ?? "0";
  const beltInfo   = BELT_COLORS[belt] ?? BELT_COLORS.white;
  const monthName  = MONTH_NAMES[monthNum] ?? "Unknown";

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
          padding: "48px 56px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ fontSize: "44px" }}>🥋</div>
            <div style={{ color: "#10B981", fontSize: "36px", fontWeight: "bold", letterSpacing: "-1px" }}>
              BJJ App
            </div>
          </div>
          <div
            style={{
              backgroundColor: beltInfo.bg,
              color: beltInfo.text,
              borderRadius: "10px",
              padding: "6px 20px",
              fontSize: "22px",
              fontWeight: "bold",
              border: belt === "white" ? "2px solid #374151" : "none",
            }}
          >
            {beltInfo.label}
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <div style={{ color: "#9ca3af", fontSize: "22px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "3px" }}>
            Monthly Training Report
          </div>
          <div style={{ color: "#ffffff", fontSize: "48px", fontWeight: "bold" }}>
            {monthName} {year}
          </div>
        </div>

        {/* Stats grid — 2×2 */}
        <div style={{ display: "flex", gap: "20px" }}>
          {/* Sessions */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "16px",
              padding: "24px 16px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#10B981", fontSize: "64px", fontWeight: "bold", lineHeight: 1 }}>
              {sessions}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "18px", marginTop: "8px" }}>
              Sessions
            </div>
          </div>

          {/* Hours */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "16px",
              padding: "24px 16px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#60a5fa", fontSize: "64px", fontWeight: "bold", lineHeight: 1 }}>
              {hours}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "18px", marginTop: "8px" }}>
              Hours
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
              borderRadius: "16px",
              padding: "24px 16px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#fbbf24", fontSize: "64px", fontWeight: "bold", lineHeight: 1 }}>
              {streak}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "18px", marginTop: "8px" }}>
              Day Streak
            </div>
          </div>

          {/* Techniques */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              flex: 1,
              backgroundColor: "#18181b",
              borderRadius: "16px",
              padding: "24px 16px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ color: "#c084fc", fontSize: "64px", fontWeight: "bold", lineHeight: 1 }}>
              {techniques}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "18px", marginTop: "8px" }}>
              Techniques
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#6b7280", fontSize: "18px" }}>
            Track Your BJJ Journey
          </div>
          <div style={{ color: "#6b7280", fontSize: "18px" }}>
            bjj-app.net
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

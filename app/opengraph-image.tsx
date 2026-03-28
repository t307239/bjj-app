import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BJJ App — Brazilian Jiu-Jitsu Training Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default OG image for the entire site.
 * Shown when sharing bjj-app.net on social media (Twitter, Facebook, LINE, etc.)
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0B1120 0%, #0d2818 50%, #0B1120 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo area */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <span style={{ fontSize: 64 }}>🥋</span>
          <span
            style={{
              fontSize: 56,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: -2,
            }}
          >
            BJJ App
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: "#a1a1aa",
            marginBottom: 48,
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          Track your Brazilian Jiu-Jitsu training — log sessions,
          record techniques, and grow.
        </div>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 40,
          }}
        >
          {["Training Log", "Skill Map", "Streak Tracker", "Technique Journal"].map(
            (feature) => (
              <div
                key={feature}
                style={{
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 24,
                  padding: "10px 24px",
                  fontSize: 18,
                  color: "#10B981",
                  fontWeight: 600,
                }}
              >
                {feature}
              </div>
            )
          )}
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 20,
            color: "#52525b",
            letterSpacing: 1,
          }}
        >
          bjj-app.net
        </div>

        {/* Decorative gradient bar at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #10B981, #34d399, #10B981)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}

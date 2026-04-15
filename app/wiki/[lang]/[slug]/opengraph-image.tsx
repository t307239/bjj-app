import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "BJJ Wiki";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * #20: Dynamic OGP image for Wiki article pages.
 * Derives a human-readable title from the URL slug.
 */
export default async function Image({
  params,
}: {
  params: { lang: string; slug: string };
}) {
  const { lang, slug } = await Promise.resolve(params);

  // slug → readable title  (e.g. "arm-bar-from-guard" → "Arm Bar From Guard")
  const title = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const langLabel =
    lang === "ja" ? "日本語" : lang === "pt" ? "Português" : "English";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "64px 80px",
          background: "linear-gradient(135deg, #0B1120 0%, #1a1035 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top brand bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 36 }}>🥋</span>
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#f472b6",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            BJJ Wiki
          </span>
          <span
            style={{
              fontSize: 13,
              color: "#64748b",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 999,
              padding: "3px 12px",
              marginLeft: 8,
            }}
          >
            {langLabel}
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 40 ? 52 : 64,
            fontWeight: 800,
            color: "#f8fafc",
            lineHeight: 1.15,
            maxWidth: 900,
            marginBottom: 28,
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: "#94a3b8",
            marginBottom: 48,
          }}
        >
          Free BJJ reference — techniques, concepts & more
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 18,
            color: "#475569",
          }}
        >
          <span>bjj-app.net/wiki</span>
          <span style={{ color: "#334155" }}>·</span>
          <span>{lang === "ja" ? "ずっと無料" : lang === "pt" ? "Grátis para sempre" : "Free forever"}</span>
        </div>

        {/* Decorative gradient blob */}
        <div
          style={{
            position: "absolute",
            top: -100,
            right: -100,
            width: 600,
            height: 600,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}

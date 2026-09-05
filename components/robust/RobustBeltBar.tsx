/**
 * RobustBeltBar — 帯とストライプをコンパクトに視覚表示（本体 bjj-app と同系の見た目）。
 * 色付きの帯バー＋ランクバー（黒／黒帯のみ赤）＋白ストライプ本数で、帯・本数を一目で判別できる。
 * Why: テキスト「青帯 1本」だけだと直感的に分かりづらいため、実際の帯に近い見た目を出す。
 */

// 帯色（上下グラデーションで布の陰影を表現）
const BELT_GRADIENT: Record<string, string> = {
  white: "linear-gradient(180deg,#fafafa 0%,#d4d4d8 100%)",
  blue: "linear-gradient(180deg,#3b82f6 0%,#1e3a8a 100%)",
  purple: "linear-gradient(180deg,#9333ea 0%,#4a044e 100%)",
  brown: "linear-gradient(180deg,#92400e 0%,#292524 100%)",
  black: "linear-gradient(180deg,#3f3f46 0%,#000000 100%)",
};

const BELT_LABEL: Record<string, string> = {
  white: "白帯", blue: "青帯", purple: "紫帯", brown: "茶帯", black: "黒帯",
};

export default function RobustBeltBar({
  belt,
  stripes,
  showLabel = true,
  className = "",
}: {
  belt: string;
  stripes: number;
  showLabel?: boolean;
  className?: string;
}) {
  const key = (belt || "white").toLowerCase();
  const gradient = BELT_GRADIENT[key] ?? BELT_GRADIENT.white;
  // 黒帯はランクバーが赤（BJJの慣習）、それ以外は黒。
  const rankBarColor = key === "black" ? "#dc2626" : "#111111";
  const n = Math.max(0, Math.min(4, Math.round(stripes || 0)));
  const label = `${BELT_LABEL[key] ?? belt}${n > 0 ? ` ${n}本` : ""}`;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="relative inline-block rounded-[3px] overflow-hidden shrink-0 ring-1 ring-inset ring-black/40"
        style={{ width: 60, height: 13, background: gradient }}
        role="img"
        aria-label={label}
        title={label}
      >
        {/* ランクバー（帯の端の黒/赤の区画） */}
        <span
          className="absolute top-0 bottom-0 flex items-center justify-center gap-[2px] px-[3px]"
          style={{ right: 7, width: 24, background: rankBarColor }}
        >
          {/* 白ストライプ */}
          {Array.from({ length: n }).map((_, i) => (
            <span key={i} className="inline-block bg-white" style={{ width: 2, height: "72%" }} />
          ))}
        </span>
      </span>
      {showLabel && <span className="text-zinc-300 text-xs whitespace-nowrap">{label}</span>}
    </span>
  );
}

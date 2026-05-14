import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // #48: ダークモード固定 — html に class="dark" を付与して強制ダークモード
  darkMode: "class",
  theme: {
    extend: {
      // #41: Inter font variable
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      // #37: エラー時 Shake アニメーション
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out",
      },
      // z261c: z-index 中央集権 token — 用途別の semantic 名で stacking order を表現
      // 数値は既存 hardcode の semantic 順序を尊重 (旧: z-10/20/30/40/50/60/70/9999 → token)
      // 使い方: className="z-modal" / "z-toast" / "z-critical" etc
      zIndex: {
        base: "1", // canvas / baseline elements (SkillMap container, SwipeableCard back)
        floating: "10", // FAB / in-card overlays / above-flow (TrainingType skeleton overlay, ProGate)
        tooltip: "20", // chart hover tooltips / inline overlay
        "sticky-nav": "30", // sticky page headers / PageTabs
        banner: "40", // mobile bottom CTAs / confetti / back-to-top button
        dropdown: "50", // NavBar dropdown / InstallBanner / FAB / inline toasts
        "modal-backdrop": "60", // modal/sheet backdrop / OfflineBanner sticky
        modal: "61", // modal/sheet content above backdrop
        toast: "70", // top-priority Toast (above modals)
        critical: "9999", // AgeGate / EasterEgg / CookieConsent / IABSafeLink / skip-link
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    // タスク6: ADA対応 — キーボード操作時のフォーカスリングをグローバル適用
    // ブランドカラー emerald (#10B981) で統一
    plugin(({ addBase }) => {
      addBase({
        "*:focus-visible": {
          outline: "2px solid #10B981",
          "outline-offset": "2px",
          "border-radius": "4px",
        },
        "input:focus-visible, textarea:focus-visible, select:focus-visible": {
          outline: "none",
        },
      });
    }),
  ],
};

export default config;

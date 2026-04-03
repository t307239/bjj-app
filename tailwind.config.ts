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

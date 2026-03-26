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
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
    // タスク6: ADA対応 — キーボード操作時のフォーカスリンクをグローバル適用
    // ブランドカラー紫 (#7c3aed) で統一。UI_DESIGN.md準拠。
    plugin(({ addBase }) => {
      addBase({
        "*:focus-visible": {
          outline: "none",
          "box-shadow": "0 0 0 2px rgba(124, 58, 237, 0.6), 0 0 0 4px rgba(9, 9, 11, 0.8)",
        },
      });
    }),
  ],
};

export default config;

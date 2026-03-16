import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bjj: {
          dark: "#1a1a2e",
          blue: "#16213e",
          accent: "#0f3460",
          gold: "#e94560",
          light: "#f5f5f5",
        },
      },
    },
  },
  plugins: [],
};

export default config;

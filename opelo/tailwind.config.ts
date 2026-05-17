import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0b",
          900: "#111114",
          800: "#1a1a1f",
          700: "#26262d",
          600: "#3a3a44",
          500: "#5a5a66",
          400: "#8a8a98",
          300: "#b0b0bc",
          200: "#d4d4dc",
          100: "#ebebef",
          50: "#f7f7f9",
        },
        accent: {
          DEFAULT: "#f97316",
          soft: "#fb923c",
          glow: "#fed7aa",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.2)",
        glow: "0 0 0 1px rgba(249,115,22,0.3), 0 8px 30px rgba(249,115,22,0.15)",
      },
    },
  },
  plugins: [],
};

export default config;

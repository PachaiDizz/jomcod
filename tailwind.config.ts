import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1C2321",
        paper: "#F5F1E8",
        paper2: "#EBE5D6",
        orange: "#E85D2C",
        teal: "#2E6E62",
        yellow: "#F2B705",
        slate: "#6B7280",
        line: "#D8D0BC",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)"],
        body: ["var(--font-inter)"],
        mono: ["var(--font-plex-mono)"],
      },
      borderRadius: {
        card: "14px",
      },
      spacing: {
        "4.5": "18px",
      },
    },
  },
  plugins: [],
};
export default config;

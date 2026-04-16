import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Incident type accent colours
        "type-harm": {
          DEFAULT: "#f43f5e",    // rose-500
          bg: "#fff1f2",         // rose-50
          dark: "#fda4af",       // rose-300
          "dark-bg": "#4c0519",  // rose-950
        },
        "type-layoff": {
          DEFAULT: "#f59e0b",    // amber-500
          bg: "#fffbeb",         // amber-50
          dark: "#fcd34d",       // amber-300
          "dark-bg": "#451a03",  // amber-950
        },
        "type-regulatory": {
          DEFAULT: "#3b82f6",    // blue-500
          bg: "#eff6ff",         // blue-50
          dark: "#93c5fd",       // blue-300
          "dark-bg": "#172554",  // blue-950
        },
        "type-failure": {
          DEFAULT: "#8b5cf6",    // violet-500
          bg: "#f5f3ff",         // violet-50
          dark: "#c4b5fd",       // violet-300
          "dark-bg": "#2e1065",  // violet-950
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "rgb(var(--paper-rgb) / <alpha-value>)",
          warm: "rgb(var(--paper-warm-rgb) / <alpha-value>)",
          bright: "rgb(var(--paper-bright-rgb) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink-rgb) / <alpha-value>)",
          deep: "rgb(var(--ink-deep-rgb) / <alpha-value>)",
          soft: "rgb(var(--ink-soft-rgb) / <alpha-value>)",
          faint: "rgb(var(--ink-faint-rgb) / <alpha-value>)",
        },
        stone: {
          ash: "#e8e2d4",
          mist: "#d7cfbd",
          whisper: "#efeadf",
        },
        liturgical: {
          blue: "rgb(var(--liturgical-blue-rgb) / <alpha-value>)",
          blueLight: "#7aa7dc",
          gold: "rgb(var(--liturgical-gold-rgb) / <alpha-value>)",
          red: "rgb(var(--liturgical-red-rgb) / <alpha-value>)",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Cormorant Garamond", "EB Garamond", "Georgia", "serif"],
        display: ["var(--font-display)", "Cormorant Garamond", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        liturgical: "0.14em",
      },
      boxShadow: {
        paper: "0 1px 0 rgba(20,20,20,0.04), 0 30px 60px -40px rgba(20,20,20,0.18)",
      },
      maxWidth: {
        reading: "68ch",
      },
    },
  },
  plugins: [],
};

export default config;

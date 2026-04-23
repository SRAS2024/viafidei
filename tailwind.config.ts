import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: "#fbf8f1",
          warm: "#f5efe3",
          bright: "#ffffff",
        },
        ink: {
          DEFAULT: "#111111",
          deep: "#0a0a0a",
          soft: "#2a2a2a",
          faint: "#4a4a4a",
        },
        stone: {
          ash: "#e8e2d4",
          mist: "#d7cfbd",
          whisper: "#efeadf",
        },
        liturgical: {
          blue: "#1f3a8a",
          blueLight: "#7aa7dc",
          gold: "#b68d40",
          red: "#8b1a1a",
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

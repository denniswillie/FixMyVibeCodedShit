import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07110f",
        sand: "#f4ead9",
        ember: "#ff8559",
        moss: "#76d1a8",
        steel: "#9cb8b1",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        serif: ["'Fraunces'", "serif"],
      },
      boxShadow: {
        hero: "0 30px 80px rgba(5, 17, 15, 0.45)",
        panel: "0 22px 48px rgba(7, 17, 15, 0.16)",
      },
      keyframes: {
        "hero-rise": {
          "0%": { opacity: "0", transform: "translateY(28px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "terminal-drift": {
          "0%": { transform: "translate3d(0, 0, 0) rotate(-6deg)" },
          "50%": { transform: "translate3d(-1.5%, -1%, 0) rotate(-5deg)" },
          "100%": { transform: "translate3d(0, 0, 0) rotate(-6deg)" },
        },
        "signal-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(0.92)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
        "panel-reveal": {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "hero-rise": "hero-rise 800ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "terminal-drift": "terminal-drift 18s ease-in-out infinite",
        "signal-pulse": "signal-pulse 1.8s ease-in-out infinite",
        "panel-reveal": "panel-reveal 550ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;

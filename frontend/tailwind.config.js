/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Ink-tinted dark surfaces (premium dark mode, not grey).
        slate: { 800: "#232833", 850: "#191D26", 900: "#12151C", 950: "#0B0D12" },
        ink: { DEFAULT: "#0E1117", 900: "#0E1117", 800: "#161A22" },
        accent: { DEFAULT: "#2563EB", 50: "#EFF4FF", 100: "#DBE6FE", 500: "#3B7BF6", 600: "#2563EB", 700: "#1D4FD8" },
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.03)",
        lift: "0 2px 4px -1px rgb(15 23 42 / 0.06), 0 12px 28px -8px rgb(15 23 42 / 0.18)",
      },
      keyframes: {
        "toast-in": { from: { opacity: "0", transform: "translateY(8px) scale(0.98)" }, to: { opacity: "1", transform: "none" } },
        "pulse-ring": { "0%": { boxShadow: "0 0 0 0 rgb(220 38 38 / 0.55)" }, "70%": { boxShadow: "0 0 0 8px rgb(220 38 38 / 0)" }, "100%": { boxShadow: "0 0 0 0 rgb(220 38 38 / 0)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "toast-in": "toast-in 220ms cubic-bezier(0.2, 0, 0, 1)",
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

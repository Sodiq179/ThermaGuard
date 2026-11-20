/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        lift: "0 4px 6px -1px rgb(15 23 42 / 0.06), 0 12px 24px -6px rgb(15 23 42 / 0.12)",
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

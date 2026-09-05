/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0b1426",
        panel: "#111d33",
        panel2: "#182742",
        border: "#25365a",
        gold: "#3b82f6",
        goldSoft: "#60a5fa",
        buy: "#22c55e",
        sell: "#ef4444",
        muted: "#8ea2c4",
        text: "#e8eefa",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

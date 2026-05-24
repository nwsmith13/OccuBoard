/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        occuBlue: "#0F5EA8",
        occuSky: "#7FD7E7",
        occuCyan: "#06B6D4",
        occuGreen: "#34D399",
        occuPurple: "#7C3AED",
        brand: {
          50: "#eef9fc",
          100: "#d6f3f8",
          200: "#b5eaf3",
          300: "#7FD7E7",
          400: "#36c6dc",
          500: "#06B6D4",
          600: "#0b8fb9",
          700: "#0F5EA8",
          800: "#124d83",
          900: "#153f67",
        },
        ink: "#17243a",
      },
      boxShadow: {
        soft: "0 16px 42px rgba(15, 94, 168, 0.11)",
        card: "0 8px 24px rgba(23, 36, 58, 0.07)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

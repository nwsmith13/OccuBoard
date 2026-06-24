/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        occuBlue: "#07111F",
        occuSky: "#FFB26B",
        occuCyan: "#FF7A00",
        occuGreen: "#22C55E",
        occuPurple: "#0D1B2A",
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#FF7A00",
          600: "#ea580c",
          700: "#c2410c",
          800: "#0D1B2A",
          900: "#07111F",
          950: "#020617",
        },
        ink: "#07111F",
        navy: {
          900: "#07111F",
          800: "#0D1B2A",
          700: "#14233A",
        },
      },
      boxShadow: {
        soft: "0 18px 46px rgba(7, 17, 31, 0.14)",
        card: "0 10px 28px rgba(7, 17, 31, 0.08)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

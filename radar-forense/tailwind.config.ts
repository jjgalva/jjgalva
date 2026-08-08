import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#7366FE",
        secondary: "#FF66E5",
        ink: {
          950: "#0A0A14",
          900: "#0E0E1C",
          800: "#15152A",
          700: "#1E1E38",
          600: "#2A2A4A",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        glow: "0 0 40px rgba(115, 102, 254, 0.25)",
        "glow-pink": "0 0 40px rgba(255, 102, 229, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;

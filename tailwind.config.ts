import type { Config } from "tailwindcss";

// Palette is drawn from adire, the indigo resist-dyed cloth Abeokuta is known for.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 50: "#F2F3F9", 100: "#E4E7F3", 200: "#C7CDE6", 500: "#3A4A9A", 700: "#1E2A5E", 900: "#121936" },
        paper: "#FAFAF8",
        leaf: { 50: "#E8F4EE", 600: "#17734C", 700: "#115A3B" },
        sun: { 100: "#FBEFD2", 500: "#E0A02B", 700: "#8A5E0C" },
        pepper: { 50: "#FBEAE7", 600: "#BF3B2C", 700: "#8F2A1E" },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Public Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

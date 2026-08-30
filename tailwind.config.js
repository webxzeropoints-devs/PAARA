/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Playfair Display", "serif"],
        script: ["BrilliantCut", "cursive"],
        body: ["Jost", "sans-serif"],
      },
      colors: {
        sand: "#F7F1E6",
        shell: "#EFE4D2",
        cocoa: "#6B4A33",
        gold: "#B8874A",
        ocean: "#2E6E7E",
      },
    },
  },
  plugins: [],
};

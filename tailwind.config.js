const tokens = require('../softbits-shared/tailwind-tokens');

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../softbits-shared/components/**/*.{ts,tsx}",
    "../softbits-shared/hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: tokens.colors,
      fontFamily: tokens.fontFamily,
      boxShadow: tokens.boxShadow || {},
    },
  },
  plugins: [],
}

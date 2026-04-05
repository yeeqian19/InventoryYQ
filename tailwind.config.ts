/** @type {import('tailwindcss').Config} */
export default {
  // Tailwind v4: content paths are auto-detected via @tailwindcss/postcss
  // This file is kept for theme extensions if needed in the future
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

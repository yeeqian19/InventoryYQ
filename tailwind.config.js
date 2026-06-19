/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand (from design-export/tokens.json)
        brand: {
          green: '#7cb342',
          greenHover: '#689f38',
          emerald: '#10b981',
          emeraldDark: '#059669',
        },
        tile: {
          hq: '#418bca',
          rm: '#00c0ef',
          branch: '#00a65a',
          stock: '#605ca8',
          staff: '#1e293b',
        },
        surface: {
          appBg: '#f8fafc',
          appBgAlt: '#f3f7f9',
          card: '#ffffff',
          darkBg: '#0f172a',
          darkCard: '#1e293b',
        },
        status: {
          success: '#10b981',
          danger: '#f43f5e',
          warning: '#f59e0b',
          info: '#3b82f6',
          errorText: '#f87171',
        },
      },
    },
  },
  plugins: [],
};

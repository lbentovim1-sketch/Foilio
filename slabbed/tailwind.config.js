/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0e1116',
        surface: '#161b23',
        'surface-2': '#1d242e',
        line: '#28303c',
        'text-primary': '#e9ecf1',
        dim: '#8b94a3',
        gold: '#e6b93f',
        green: '#3fbe7e',
        red: '#e35a52',
        blue: '#5b9cf5',
        'psa-red': '#c8102e',
      },
      fontFamily: {
        heading: ['var(--font-barlow)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      fontVariantNumeric: {
        'tabular': 'tabular-nums',
      },
    },
  },
  plugins: [],
};

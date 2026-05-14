/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F95F9E', // vibrant pink
          light: '#FC9CBF', // soft pink
        },
        secondary: '#F4F1AD', // pale yellow
        accent: '#C2F4FF', // cyan
        background: {
          DEFAULT: '#FFFFFF', // Light mode bg
          dark: '#0F172A', // Dark mode bg
        },
        cards: {
          DEFAULT: '#FFFFFF',
          dark: '#1E293B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

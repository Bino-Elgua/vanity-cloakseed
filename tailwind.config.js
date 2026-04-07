/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '475px',
      },
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e5ebff',
          500: '#667eea',
          600: '#5568d3',
          700: '#4c63c4',
          800: '#3f4fa0',
          900: '#2d3561',
        },
        secondary: {
          500: '#764ba2',
          600: '#6a3f96',
          700: '#5e358a',
        },
      },
      fontFamily: {
        mono: ['Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

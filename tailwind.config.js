/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f4f7f5',
          100: '#e3ebe6',
          200: '#c5d5cb',
          300: '#9bb5a5',
          400: '#6f917c',
          500: '#517461',
          600: '#3e5c4c',
          700: '#334a3e',
          800: '#2b3d34',
          900: '#25332c',
          950: '#121c17',
        },
        leaf: {
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        coral: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(18, 28, 23, 0.08)',
      },
    },
  },
  plugins: [],
};

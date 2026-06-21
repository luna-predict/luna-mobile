/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0, 0%, 98%)',
        card: 'rgba(255, 255, 255, 0.7)',
        primary: 'hsl(340, 82%, 52%)',
        accent: 'hsl(340, 60%, 90%)',
        muted: 'hsl(240, 4.8%, 95.9%)',
        mutedForeground: 'hsl(240, 3.8%, 46.1%)',
        period: {
          400: '#FB7185',
          500: '#F43F5E',
        },
        conceive: {
          400: '#2DD4BF',
          500: '#14B8A6',
        },
        pregnancy: {
          400: '#C084FC',
          500: '#A855F7',
        },
        perimenopause: {
          400: '#A78BFA',
          500: '#8B5CF6',
        }
      }
    },
  },
  plugins: [],
}

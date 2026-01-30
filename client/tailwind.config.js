/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tile: {
          red: '#dc2626',
          blue: '#2563eb',
          yellow: '#ca8a04',
          black: '#1f2937',
        },
      },
    },
  },
  plugins: [],
};

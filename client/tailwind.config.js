/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#E70013', // Rouge Tunisie
        secondary: '#0F766E', // Vert Finance/Teal
        accent: '#F59E0B', // Ambre/Or
        'dark-neutral': '#1E293B', // Slate
        'light-neutral': '#F8FAFC', // Blanc cassé
        'border-neutral': '#E2E8F0', // Border Neutral
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};

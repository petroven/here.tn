/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // "class" : le thème est piloté par l'app (Système / Clair / Sombre) via colorScheme.set().
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Orange BuyHere (#FF6B00) et ses nuances
        primary: {
          50: '#FFF4EB',
          100: '#FFE4CC',
          200: '#FFC999',
          300: '#FFA666',
          400: '#FF8833',
          DEFAULT: '#FF6B00',
          500: '#FF6B00',
          600: '#E05E00',
          700: '#B84D00',
          800: '#8A3A00',
          900: '#5C2700',
        },
        ink: {
          DEFAULT: '#1F2937', // texte principal (gris foncé)
          muted: '#6B7280',
          subtle: '#9CA3AF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F5F6F8',
          dark: '#0F1115',
          'dark-card': '#1A1D23',
          'dark-muted': '#23272F',
        },
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#F59E0B',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
    },
  },
  plugins: [],
};

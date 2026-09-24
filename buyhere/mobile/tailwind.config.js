/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // "class" : le thème est piloté par l'app (Système / Clair / Sombre) via colorScheme.set().
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identité buyhere. du site web (client/tailwind.config.js) :
        // terre de Nabeul #C4532C, charbon #1E1B18, chaux/crème #F4ECDF.
        primary: {
          50: '#FCF5F3',
          100: '#F8E4DE',
          200: '#EEC3B4',
          300: '#E39B82',
          400: '#D87350',
          DEFAULT: '#C4532C',
          500: '#C4532C',
          600: '#AE4926',
          700: '#994122',
          800: '#6E2E19',
          900: '#4A1F11',
        },
        ink: {
          DEFAULT: '#1E1B18', // charbon
          muted: '#8C8378',
          subtle: '#B8B0A3',
        },
        cream: '#F4ECDF',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F4ECDF',
          page: '#FBF8F3',
          dark: '#141210',
          'dark-card': '#1E1B18',
          'dark-muted': '#2A2622',
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

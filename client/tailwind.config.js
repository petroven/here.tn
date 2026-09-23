/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Identité buyhere. — trois couleurs (charbon / chaux / terre de
        // Nabeul), voir client/public/brand pour les logos et le guide
        // d'origine. terre-700 est la teinte de marque exacte (#C4532C) ;
        // les autres crans sont dérivés pour couvrir les usages Tailwind
        // habituels (hover, fonds pastel, halos d'ombre).
        ink: '#1E1B18',
        cream: '#F4ECDF',
        terre: {
          50: '#fcf5f3',
          100: '#f8e4de',
          200: '#eec3b4',
          300: '#e39b82',
          400: '#d87350',
          500: '#d46741',
          600: '#d15b32',
          700: '#c4532c',
          800: '#994122',
          900: '#6e2e19',
        },
        primary: '#C4532C', // Terre de Nabeul
        secondary: '#1E1B18', // Charbon
        accent: '#C4532C',
        'dark-neutral': '#1E1B18',
        'light-neutral': '#FBF8F3',
        'border-neutral': '#E2D9CB',
      },
      fontFamily: {
        sans: ['"Schibsted Grotesk"', 'system-ui', 'sans-serif'],
        arabic: ['Tajawal', '"Schibsted Grotesk"', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(30, 27, 24, 0.08)',
      },
    },
  },
  plugins: [],
};

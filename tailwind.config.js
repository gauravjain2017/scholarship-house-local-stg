/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: {
          DEFAULT: '#072B53',
          muted: '#28456E',
        },
        accent: {
          DEFAULT: '#1E7AC0',
          light: '#0AAFE5',
        },
        // Semantic backgrounds
        app: '#F5F7FA',
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#E5EBF4',
          muted: '#D0F2FF',
        },
        panel: '#F8FAFC',
      },
      backgroundColor: {
        app: '#F5F7FA',
        surface: '#FFFFFF',
        'surface-alt': '#E5EBF4',
        'surface-muted': '#D0F2FF',
        panel: '#F8FAFC',
      },
      textColor: {
        primary: '#072B53',
        secondary: '#475569',
        muted: '#6B7280',
      },

      borderColor: {
        subtle: '#E5EBF4',
        DEFAULT: '#D4E9F8',
      },
    },
  },
  plugins: [],
};

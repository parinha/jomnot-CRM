import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          main: '#FFC206',
          secondary: '#FFC206',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
      },
      fontFamily: {
        KantumruyPro: ['KantumruyPro', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;

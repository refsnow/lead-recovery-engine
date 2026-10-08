import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#faf8fd',
          100: '#f3eff9',
          200: '#e5dcf2',
          300: '#c8badf',
          400: '#9d8dbd',
          500: '#756499',
          600: '#584978',
          700: '#41345c',
          800: '#2b2043',
          900: '#150d28',
          950: '#080014', // Exact Ultraviolet Dark (#080014)
        },
        brand: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#E879F9', // Exact Ultraviolet Lilac (#E879F9)
          500: '#A855F7', // Exact Ultraviolet Purple (#A855F7)
          600: '#7e22ce',
          700: '#5B21B6', // Exact Ultraviolet Deep Violet (#5B21B6)
          800: '#4c1d95',
          900: '#2e1065',
          950: '#080014', // Exact Ultraviolet Dark (#080014)
        },
        ultraviolet: {
          dark: '#080014',
          deep: '#5B21B6',
          vibrant: '#A855F7',
          neon: '#E879F9',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(8 0 20 / 0.05), 0 1px 2px -1px rgb(8 0 20 / 0.05)',
        pop: '0 10px 25px -5px rgb(8 0 20 / 0.14), 0 8px 10px -6px rgb(8 0 20 / 0.08)',
        glow: '0 0 25px -5px rgb(168 85 247 / 0.35)',
      },
    },
  },
  plugins: [],
} satisfies Config;

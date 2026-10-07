import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d4d9e3', 300: '#aeb7c9',
          400: '#8190aa', 500: '#607190', 600: '#4c5a77', 700: '#3e4961',
          800: '#363e52', 900: '#242a38', 950: '#161a23',
        },
        brand: {
          50: '#eef6ff', 100: '#d9eaff', 200: '#bcdbff', 300: '#8ec5ff',
          400: '#59a4ff', 500: '#3381fb', 600: '#1d62f0', 700: '#164ddc',
          800: '#1840b2', 900: '#1a3a8c', 950: '#142555',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(16 24 40 / 0.04), 0 1px 3px 0 rgb(16 24 40 / 0.06)',
        pop: '0 8px 24px -4px rgb(16 24 40 / 0.12), 0 2px 6px -2px rgb(16 24 40 / 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config;

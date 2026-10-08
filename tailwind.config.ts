import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#080014',  // Page canvas background (#080014)
          100: '#0f0322', // Card & elevated container background
          150: '#14062b', // Floating surfaces / dropdowns
          200: '#230e46', // Card borders & divider lines
          300: '#381a69', // Interactive hover borders
          400: '#7558a3', // Subtle placeholders, icons, hints
          500: '#9b7ec9', // Secondary labels & descriptions
          600: '#bfa7e6', // Secondary text
          700: '#ddcbf7', // Primary body text
          800: '#f0e6fd', // High-contrast text
          900: '#ffffff', // Crisp white titles & metrics
          950: '#ffffff',
        },
        brand: {
          50: '#1b053a',
          100: '#2b0959',
          200: '#3e0e7d',
          300: '#d8b4fe',
          400: '#E879F9', // Exact Ultraviolet Lilac (#E879F9)
          500: '#A855F7', // Exact Ultraviolet Purple (#A855F7)
          600: '#7e22ce', // Primary Action button
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

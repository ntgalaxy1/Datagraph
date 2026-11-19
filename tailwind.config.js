/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Tahoma', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Vazirmatn', 'monospace'],
      },
      colors: {
        slate: {
          50: '#FCFAFA', 100: '#F5F0F1', 200: '#E8DFE1',
          300: '#D4C7CA', 400: '#A59499', 500: '#79686E',
          600: '#625258', 700: '#493B40', 800: '#30272A', 900: '#191416',
        },
        brand: {
          DEFAULT: '#D43342', // Exact sampled RGB(212, 51, 66) from DataGraph logo!
          dark: '#B52432',
          light: '#E34856',
          soft: 'rgba(212, 51, 66, 0.08)',
        },
        surface: {
          50: '#FFFFFF',
          100: '#FAF7F7',
          200: '#F2E9EA',
          300: '#E5D6D8',
        },
        ink: {
          900: '#171314',
          700: '#393234',
          500: '#73676A',
          400: '#9A8D90',
        }
      },
      keyframes: {
        logoIntro: {
          '0%': { opacity: '0', transform: 'scale(0.94) translateY(8px)' },
          '45%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '80%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(1.03) translateY(-4px)' },
        },
        fadeUpSoft: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      animation: {
        'logo-intro': 'logoIntro 2.1s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'fade-up-soft': 'fadeUpSoft 0.65s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Karnataka palette — deep red / ochre / sandalwood / green
        primary: {
          DEFAULT: '#9B2226',
          50: '#FBEFEF',
          100: '#F3D2D3',
          200: '#E4A5A7',
          300: '#D07678',
          400: '#B34A4C',
          500: '#9B2226',
          600: '#821B1F',
          700: '#661316',
          800: '#4A0E10',
          900: '#2E0809'
        },
        ochre: {
          DEFAULT: '#CA6702',
          50: '#FDF1E3',
          100: '#F8DDB8',
          200: '#F0BE7C',
          300: '#E29B3E',
          400: '#CA6702',
          500: '#A85402',
          600: '#823F01',
          700: '#5C2D01'
        },
        sand: {
          DEFAULT: '#E9D8A6',
          50: '#FBF7EC',
          100: '#F5EEDB',
          200: '#E9D8A6',
          300: '#DCC281',
          400: '#CBAC5E',
          500: '#B49341'
        },
        forest: {
          DEFAULT: '#2A9D8F',
          50: '#E6F5F3',
          100: '#C2E8E3',
          200: '#8FD4CB',
          300: '#5CBFB2',
          400: '#2A9D8F',
          500: '#1F7A70',
          600: '#155A53',
          700: '#0C3B37'
        },
        ink: {
          DEFAULT: '#1B1A17',
          50: '#F7F6F3',
          100: '#EDEBE5',
          200: '#DCD8CE',
          300: '#C2BCAF',
          400: '#9E9788',
          500: '#7B776C',
          600: '#5C584F',
          700: '#4A473F',
          800: '#2F2D28',
          900: '#1B1A17',
          soft: '#4A473F',
          mute: '#7B776C'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        kannada: ['"Noto Sans Kannada"', 'Inter', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(27,26,23,0.04), 0 8px 24px -12px rgba(27,26,23,0.18)',
        lift: '0 2px 4px rgba(27,26,23,0.06), 0 20px 40px -20px rgba(27,26,23,0.28)'
      },
      borderRadius: {
        xl2: '1.25rem'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'pulse-soft': 'pulse-soft 1.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
}

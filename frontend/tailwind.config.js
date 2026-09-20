/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: '#0B0F19', // Deep space dark
        surface: '#111827', // Slate 900
        'surface-elevated': '#1F2937', // Slate 800
        primary: '#10B981', // Emerald 500
        'primary-glow': 'rgba(16, 185, 129, 0.15)',
        secondary: '#6366F1', // Indigo 500
        danger: '#F43F5E', // Rose 500
        'danger-glow': 'rgba(244, 63, 94, 0.15)',
        text: {
          primary: '#F9FAFB', // Gray 50
          secondary: '#9CA3AF', // Gray 400
          tertiary: '#6B7280', // Gray 500
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-sm': '0 2px 10px rgba(0, 0, 0, 0.05)',
        'neon-primary': '0 0 15px rgba(16, 185, 129, 0.5)',
        'neon-danger': '0 0 15px rgba(244, 63, 94, 0.5)',
      },
      backgroundImage: {
        'mesh-dark': 'radial-gradient(at 40% 20%, hsla(228,100%,74%,0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.08) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(355,100%,93%,0.05) 0px, transparent 50%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    }
  },
  plugins: [],
}

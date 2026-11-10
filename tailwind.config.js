/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '2px',
        none: '0px',
        sm: '2px',
        md: '3px',
        lg: '4px',
      },
      colors: {
        border: {
          light: '#cbd5e1',
          dark: '#334155',
        },
        surface: {
          light: '#ffffff',
          lightsubtle: '#f8fafc',
          dark: '#0f172a',
          darksubtle: '#1e293b',
        }
      }
    },
  },
  plugins: [],
}

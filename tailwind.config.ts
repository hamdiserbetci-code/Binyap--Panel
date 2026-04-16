import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './AppLayout.tsx'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Helvetica Neue', 'system-ui', 'sans-serif',
        ],
      },
      screens: {
        xs: '375px',
      },
      spacing: {
        safe: 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
}
export default config

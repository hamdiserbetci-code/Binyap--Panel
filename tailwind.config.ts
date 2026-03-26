import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text',
          'Helvetica Neue', 'system-ui', 'sans-serif',
        ],
      },
      colors: {
        ios: {
          bg:        '#000000',
          bg2:       '#1C1C1E',
          bg3:       '#2C2C2E',
          bg4:       '#3A3A3C',
          separator: 'rgba(60,60,67,0.36)',
          blue:      '#0A84FF',
          green:     '#30D158',
          red:       '#FF453A',
          orange:    '#FF9F0A',
          yellow:    '#FFD60A',
          purple:    '#BF5AF2',
          teal:      '#5AC8F5',
          label:     '#FFFFFF',
          label2:    'rgba(235,235,245,0.6)',
          label3:    'rgba(235,235,245,0.3)',
          fill:      'rgba(120,120,128,0.2)',
          fill2:     'rgba(120,120,128,0.16)',
          fill3:     'rgba(120,120,128,0.12)',
        },
      },
      borderRadius: {
        ios:  '10px',
        ios2: '13px',
        ios3: '16px',
        ios4: '20px',
      },
      backdropBlur: {
        ios: '20px',
      },
      boxShadow: {
        ios: '0 2px 20px rgba(0,0,0,0.5)',
        'ios-sm': '0 1px 8px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
}
export default config

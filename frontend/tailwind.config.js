/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // 苹果经典配色
        apple: {
          blue: '#0071e3',
          blueHover: '#0077ed',
          black: '#1d1d1f',      // 深空黑
          gray: '#86868b',        // 次要文字
          bg: '#f5f5f7',          // 浅灰背景
          card: '#ffffff',
          line: '#d2d2d7'
        }
      },
      borderRadius: {
        DEFAULT: '8px'
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.04)',
        cardHover: '0 6px 20px rgba(0,0,0,0.08)'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: []
};

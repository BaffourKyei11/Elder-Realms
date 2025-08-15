/**********************
 * Tailwind Config
 **********************/
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        royalPurple: '#6B21A8',
        royalBlue: '#1D4ED8',
        ink: '#0F172A',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 1px rgb(0 0 0 / 0.05)'
      },
      screens: {
        mobile: { raw: '(max-width: 640px)' },
        tablet: { raw: '(min-width: 641px) and (max-width: 1024px)' },
        desktop: { raw: '(min-width: 1025px)' }
      },
      fontSize: {
        'h1-fluid': ['clamp(2rem, 6vw, 3rem)', { lineHeight: '1.2' }],
        'h2-fluid': ['clamp(1.75rem, 4vw, 2.5rem)', { lineHeight: '1.3' }],
        'h3-fluid': ['clamp(1.25rem, 3vw, 1.75rem)', { lineHeight: '1.35' }],
        base: ['clamp(1rem, 2vw, 1.125rem)', { lineHeight: '1.6' }]
      }
    }
  },
  plugins: []
};

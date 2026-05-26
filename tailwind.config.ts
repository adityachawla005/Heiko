import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pink: { DEFAULT: '#E491A6', dark: '#c97a8e' },
        mauve: { DEFAULT: '#845763', light: '#9d6e7a', dark: '#6b4450' },
        mint: { DEFAULT: '#92E4BA', dark: '#72c49a' },
        sage: { DEFAULT: '#90C67F', dark: '#72a863' },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}

export default config

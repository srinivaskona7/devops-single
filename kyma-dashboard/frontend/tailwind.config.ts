import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#060d1f',
        sidebar: '#0a1628',
        card: '#0d1b2e',
        border: 'rgba(99,102,241,0.12)',
        accent: { DEFAULT: '#6366f1', hover: '#818cf8', muted: 'rgba(99,102,241,0.15)' },
        kyma: {
          bg: '#060d1f',
          sidebar: '#0a1628',
          card: '#0d1b2e',
          indigo: '#6366f1',
          cyan: '#06b6d4',
          violet: '#8b5cf6',
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
          text: '#e2e8f0',
          muted: '#64748b',
          subtle: '#334155',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { lg: '0.75rem', md: '0.5rem', sm: '0.375rem' },
    },
  },
  plugins: [require('@tailwindcss/typography')],
} satisfies Config;

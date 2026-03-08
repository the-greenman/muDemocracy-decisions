import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'Verdana', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Base surfaces
        base: '#0f1117',
        surface: '#1c2033',
        'surface-2': '#252a3d',
        overlay: '#2e3450',

        // Borders
        border: '#3a4060',
        'border-strong': '#4a5280',
        'border-locked': '#2a3a50',

        // Text
        'text-primary': '#e8eaf2',
        'text-secondary': '#8891b0',
        'text-muted': '#5a6380',
        'text-locked': '#6a7590',

        // Semantic colours
        settled: '#34d399',         // locked / confirmed
        'settled-dim': '#1a4a38',   // locked field background
        accent: '#6c8ef7',          // primary action / active
        'accent-dim': '#1e2a6e',    // accent background
        caution: '#f59e0b',         // generating / in-progress
        'caution-dim': '#3a2800',   // caution background
        danger: '#f87171',          // error / dismiss
        'danger-dim': '#3a1010',    // danger background

        // Tag category colours
        'tag-topic': '#6c8ef7',
        'tag-topic-bg': '#1e2a6e',
        'tag-team': '#34d399',
        'tag-team-bg': '#1a4a38',
        'tag-project': '#f59e0b',
        'tag-project-bg': '#3a2800',

        // Candidate states
        'candidate-new': '#f59e0b',
        'candidate-dismissed': '#5a6380',
      },
      fontSize: {
        // Display density (projection)
        'display-title': ['2rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-field': ['1.375rem', { lineHeight: '1.5' }],
        'display-label': ['0.9375rem', { lineHeight: '1.4', fontWeight: '700' }],
        'display-meta': ['0.875rem', { lineHeight: '1.4' }],

        // Facilitator density (laptop)
        'fac-title': ['1.125rem', { lineHeight: '1.3', fontWeight: '700' }],
        'fac-field': ['0.9375rem', { lineHeight: '1.5' }],
        'fac-label': ['0.75rem', { lineHeight: '1.4', fontWeight: '700', letterSpacing: '0.05em' }],
        'fac-meta': ['0.75rem', { lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        card: '0.5rem',
        pill: '9999px',
        badge: '0.25rem',
      },
      keyframes: {
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        spin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: '360deg' },
        },
        'field-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-slow': 'pulse 2s ease-in-out infinite',
        'field-in': 'field-in 0.2s ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;

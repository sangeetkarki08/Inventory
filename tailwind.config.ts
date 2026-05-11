import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Refined dark palette ─────────────────────────────────────────────
        // Slightly bluer base for a more "premium" feel (vs warm grey before).
        bg:      '#0B0E14',  // deepest background
        panel:   '#11151D',  // raised surface (cards, sidebar)
        surface: '#161B26',  // even more elevated (modals, hover states)
        border:  '#1F2632',  // subtle dividers

        text:    '#E6EBF2',  // primary text, slightly cooler than pure white
        muted:   '#7B8593',  // secondary text

        // ── Brand & status ───────────────────────────────────────────────────
        accent:  '#F59E0B',  // warm amber (existing brand)
        info:    '#60A5FA',  // brighter sky blue for info
        success: '#34D399',  // mint green for in-stock / good
        danger:  '#F87171',  // soft coral red for danger
      },
      boxShadow: {
        // Subtle layered shadows for depth.
        'soft':   '0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 1px 0 rgb(0 0 0 / 0.20)',
        'panel':  '0 1px 3px 0 rgb(0 0 0 / 0.40), 0 1px 2px -1px rgb(0 0 0 / 0.30)',
        'lifted': '0 10px 20px -5px rgb(0 0 0 / 0.40), 0 8px 10px -8px rgb(0 0 0 / 0.30)',
        'glow-amber':   '0 0 0 1px rgb(245 158 11 / 0.30), 0 8px 24px -6px rgb(245 158 11 / 0.30)',
        'glow-success': '0 0 0 1px rgb(52 211 153 / 0.30), 0 8px 24px -6px rgb(52 211 153 / 0.20)',
      },
      backgroundImage: {
        // Gradient utilities used by buttons and headers.
        'gradient-amber':   'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-panel':   'linear-gradient(180deg, #161B26 0%, #11151D 100%)',
        'gradient-radial':  'radial-gradient(circle at top right, rgb(245 158 11 / 0.10), transparent 60%)',
      },
      animation: {
        'fade-in':  'fade-in 200ms ease-out',
        'slide-in': 'slide-in 240ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'fade-in':  { '0%': { opacity: '0' },                    '100%': { opacity: '1' } },
        'slide-in': { '0%': { transform: 'translateY(4px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
} satisfies Config;

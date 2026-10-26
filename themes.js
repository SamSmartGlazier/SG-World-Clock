/*
  themes.js — the colour presets.

  Every colour on screen comes from a CSS variable (see styles.css).
  A theme is just a list of values for those variables. app.js copies the
  chosen list onto the page, so switching theme is instant and needs no
  page reload.

  `swatch` holds plain hex colours for the four colour pickers in
  ⚙ → Appearance (pickers can't show gradients or see-through colours).
  `scheme` tells the browser whether the theme is light or dark, which
  affects scrollbars and form controls.

  To add your own theme, copy a block, change the id and the values.
*/
window.THEMES = [
  {
    id: 'classic', name: 'Classic', scheme: 'light',
    swatch: { accent: '#1d4ed8', header: '#ececea', page: '#dedcd6', card: '#f6f6f4' },
    vars: {
      'page-bg': '#dedcd6', bg: '#f6f6f4', surface: '#ffffff', chrome: '#ececea',
      line: '#dcdcd8', ink: '#1c1c1e', muted: '#5c5c58', faint: '#8a8a86',
      accent: '#1d4ed8', 'accent-ink': '#ffffff', 'accent-soft': '#e8eefc', 'accent-line': '#c2d1f4',
      warn: '#b45309', flag: '#b45309', track: '#e1e1dd', work: '#a9bdf0',
      'card-shadow': '0 12px 36px rgba(0,0,0,.14)', 'card-border': '#d4d4d0',
      'header-bg': '#ececea', 'header-ink': '#1c1c1e', 'header-mark': '#1d4ed8',
      'row-bg': 'transparent', 'time-ink': '#1c1c1e'
    }
  },
  {
    id: 'glass', name: 'Glass', scheme: 'light',
    swatch: { accent: '#2b59c3', header: '#e6eefa', page: '#cfe3f7', card: '#eef3fb' },
    vars: {
      'page-bg': 'radial-gradient(circle at 15% 20%, #9ee7ff 0, transparent 40%), radial-gradient(circle at 85% 30%, #c4b5fd 0, transparent 45%), radial-gradient(circle at 50% 95%, #fbcfe8 0, transparent 45%), #e8f1fb',
      bg: 'rgba(255,255,255,.42)', surface: 'rgba(255,255,255,.78)', chrome: 'rgba(255,255,255,.35)',
      line: 'rgba(255,255,255,.75)', ink: '#0f1e3a', muted: '#3d4f6e', faint: '#5f6e8a',
      accent: '#2b59c3', 'accent-ink': '#ffffff', 'accent-soft': 'rgba(219,231,255,.75)', 'accent-line': 'rgba(43,89,195,.25)',
      warn: '#a14a08', flag: '#a14a08', track: 'rgba(15,30,58,.10)', work: 'rgba(43,89,195,.35)',
      'card-shadow': '0 20px 60px rgba(30,60,120,.25), inset 0 1px 0 rgba(255,255,255,.8)', 'card-border': 'rgba(255,255,255,.8)',
      'header-bg': 'rgba(255,255,255,.3)', 'header-ink': '#0f1e3a', 'header-mark': 'linear-gradient(135deg,#7dd3fc,#818cf8)',
      'row-bg': 'transparent', 'time-ink': '#0f1e3a'
    }
  },
  {
    id: 'navy', name: 'Navy & Teal', scheme: 'light',
    swatch: { accent: '#0f9d9a', header: '#0f2a4a', page: '#e4eaf2', card: '#ffffff' },
    vars: {
      'page-bg': 'linear-gradient(180deg, #dfe7f1 0%, #eef2f7 100%)',
      bg: '#ffffff', surface: '#ffffff', chrome: '#f4f7fb',
      line: '#e3e9f1', ink: '#0f2a4a', muted: '#52637a', faint: '#7d8b9e',
      accent: '#0f9d9a', 'accent-ink': '#ffffff', 'accent-soft': '#e3f6f5', 'accent-line': '#b5e5e3',
      warn: '#c2410c', flag: '#c2410c', track: '#e8edf3', work: '#9ddcda',
      'card-shadow': '0 1px 2px rgba(15,42,74,.08), 0 18px 40px rgba(15,42,74,.18)', 'card-border': 'transparent',
      'header-bg': '#0f2a4a', 'header-ink': '#ffffff', 'header-mark': '#0f9d9a',
      'row-bg': '#ffffff', 'time-ink': '#0f2a4a'
    }
  },
  {
    id: 'sunset', name: 'Sunset', scheme: 'light',
    swatch: { accent: '#e8590c', header: '#f76707', page: '#ffc6b3', card: '#fffaf6' },
    vars: {
      'page-bg': 'linear-gradient(135deg, #ffe3c7 0%, #ffc6b3 50%, #f9a8c4 100%)',
      bg: '#fffaf6', surface: '#ffffff', chrome: '#fff1e8',
      line: '#f6e3d6', ink: '#3b1f14', muted: '#7a5244', faint: '#9c7868',
      accent: '#e8590c', 'accent-ink': '#ffffff', 'accent-soft': '#ffeadc', 'accent-line': '#ffc9a8',
      warn: '#b0204f', flag: '#b0204f', track: '#f6e6dc', work: '#ffbf94',
      'card-shadow': '0 24px 50px rgba(160,60,30,.25)', 'card-border': 'rgba(255,255,255,.6)',
      'header-bg': 'linear-gradient(90deg, #f76707, #e64980)', 'header-ink': '#ffffff', 'header-mark': 'rgba(255,255,255,.25)',
      'row-bg': 'transparent', 'time-ink': '#3b1f14'
    }
  },
  {
    id: 'midnight', name: 'Midnight', scheme: 'dark',
    swatch: { accent: '#a78bfa', header: '#1c1640', page: '#0b0b14', card: '#14141f' },
    vars: {
      'page-bg': 'radial-gradient(circle at 30% 0%, #3b2a7a 0, transparent 50%), radial-gradient(circle at 90% 90%, #0e4a5c 0, transparent 45%), #0b0b14',
      bg: '#14141f', surface: '#1c1c2a', chrome: '#11111a',
      line: '#262636', ink: '#ecebff', muted: '#a3a1c2', faint: '#8583a8',
      accent: '#a78bfa', 'accent-ink': '#160f2e', 'accent-soft': '#241d3d', 'accent-line': '#3f3373',
      warn: '#fbbf24', flag: '#fbbf24', track: '#262636', work: '#5b4bb0',
      'card-shadow': '0 0 0 1px rgba(167,139,250,.15), 0 25px 70px rgba(91,75,176,.45)', 'card-border': 'transparent',
      'header-bg': 'linear-gradient(90deg, #1c1640, #14141f)', 'header-ink': '#ecebff', 'header-mark': 'linear-gradient(135deg,#a78bfa,#22d3ee)',
      'row-bg': 'transparent', 'time-ink': '#ffffff'
    }
  },
  {
    // Colours sampled from smartglazier.com
    id: 'sg-web', name: 'Smart Glazier · website', scheme: 'dark',
    swatch: { accent: '#f26a21', header: '#000000', page: '#000000', card: '#0f0f0f' },
    vars: {
      'page-bg': 'radial-gradient(circle at 50% 35%, #2a2a2a 0, #0a0a0a 45%, #000 75%)',
      bg: '#0f0f0f', surface: '#1b1b1b', chrome: '#0a0a0a',
      line: '#242424', ink: '#ffffff', muted: '#9a9e9e', faint: '#868a8a',
      accent: '#f26a21', 'accent-ink': '#ffffff', 'accent-soft': '#2a1a10', 'accent-line': '#5a2e12',
      warn: '#f8b420', flag: '#d9d2c4', track: '#262828', work: '#7a3f17',
      'card-shadow': '0 0 0 1px #262828, 0 30px 80px rgba(242,106,33,.18)', 'card-border': 'transparent',
      'header-bg': '#000000', 'header-ink': '#ffffff', 'header-mark': '#f26a21',
      'row-bg': 'transparent', 'time-ink': '#ffffff'
    }
  },
  {
    // Colours sampled from the Smart Glazier product screens
    id: 'sg-app', name: 'Smart Glazier · product', scheme: 'light',
    swatch: { accent: '#f26a21', header: '#262828', page: '#ecedec', card: '#ffffff' },
    vars: {
      'page-bg': 'linear-gradient(180deg, #1c1e1e 0, #1c1e1e 140px, #ecedec 140px)',
      bg: '#ffffff', surface: '#ffffff', chrome: '#f5f5f4',
      line: '#e7e7e5', ink: '#1d1f1f', muted: '#5d6262', faint: '#7a7e7e',
      accent: '#f26a21', 'accent-ink': '#ffffff', 'accent-soft': '#fff0e6', 'accent-line': '#fbcfb2',
      warn: '#a8480d', flag: '#3d4242', track: '#ececea', work: '#fcc9a3',
      'card-shadow': '0 2px 4px rgba(0,0,0,.08), 0 22px 50px rgba(0,0,0,.22)', 'card-border': 'transparent',
      'header-bg': '#262828', 'header-ink': '#ffffff', 'header-mark': '#f26a21',
      'row-bg': '#ffffff', 'time-ink': '#1d1f1f'
    }
  }
];

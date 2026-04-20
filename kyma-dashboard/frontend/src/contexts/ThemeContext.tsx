import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeName = 'kyma-dark' | 'midnight-blue' | 'forest-dark' | 'solarized-dark' | 'light-pro' | 'sap-horizon';

export interface Theme {
  name: ThemeName;
  label: string;
  description: string;
  preview: string;
  vars: Record<string, string>;
}

export const THEMES: Theme[] = [
  {
    name: 'kyma-dark',
    label: 'Kyma Dark',
    description: 'Original SAP Kyma dark theme — deep navy with indigo accents',
    preview: '#060d1f',
    vars: {
      '--bg-base': '#060d1f',
      '--bg-sidebar': '#0a1628',
      '--bg-card': '#0d1b2e',
      '--bg-card-hover': '#0f2035',
      '--accent': '#6366f1',
      '--accent-hover': '#818cf8',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#475569',
      '--border': 'rgba(99,102,241,0.15)',
      '--border-strong': 'rgba(99,102,241,0.3)',
      '--status-ok': '#10b981',
      '--status-warn': '#f59e0b',
      '--status-err': '#ef4444',
    },
  },
  {
    name: 'midnight-blue',
    label: 'Midnight Blue',
    description: 'Deep ocean blue with cyan highlights',
    preview: '#020817',
    vars: {
      '--bg-base': '#020817',
      '--bg-sidebar': '#050f1e',
      '--bg-card': '#071525',
      '--bg-card-hover': '#091a2e',
      '--accent': '#06b6d4',
      '--accent-hover': '#22d3ee',
      '--text-primary': '#e2e8f0',
      '--text-secondary': '#7dd3fc',
      '--text-muted': '#334155',
      '--border': 'rgba(6,182,212,0.15)',
      '--border-strong': 'rgba(6,182,212,0.3)',
      '--status-ok': '#10b981',
      '--status-warn': '#f59e0b',
      '--status-err': '#ef4444',
    },
  },
  {
    name: 'forest-dark',
    label: 'Forest Dark',
    description: 'Dark forest green with emerald accents',
    preview: '#0a1a0f',
    vars: {
      '--bg-base': '#0a1a0f',
      '--bg-sidebar': '#0d2015',
      '--bg-card': '#112419',
      '--bg-card-hover': '#142a1e',
      '--accent': '#10b981',
      '--accent-hover': '#34d399',
      '--text-primary': '#ecfdf5',
      '--text-secondary': '#6ee7b7',
      '--text-muted': '#374151',
      '--border': 'rgba(16,185,129,0.15)',
      '--border-strong': 'rgba(16,185,129,0.3)',
      '--status-ok': '#10b981',
      '--status-warn': '#f59e0b',
      '--status-err': '#ef4444',
    },
  },
  {
    name: 'solarized-dark',
    label: 'Solarized Dark',
    description: 'Classic Solarized dark with warm amber tones',
    preview: '#002b36',
    vars: {
      '--bg-base': '#002b36',
      '--bg-sidebar': '#003541',
      '--bg-card': '#073642',
      '--bg-card-hover': '#094052',
      '--accent': '#b58900',
      '--accent-hover': '#d6a920',
      '--text-primary': '#fdf6e3',
      '--text-secondary': '#93a1a1',
      '--text-muted': '#586e75',
      '--border': 'rgba(181,137,0,0.2)',
      '--border-strong': 'rgba(181,137,0,0.35)',
      '--status-ok': '#859900',
      '--status-warn': '#cb4b16',
      '--status-err': '#dc322f',
    },
  },
  {
    name: 'light-pro',
    label: 'Light Pro',
    description: 'Clean professional light theme',
    preview: '#f8fafc',
    vars: {
      '--bg-base': '#f8fafc',
      '--bg-sidebar': '#f1f5f9',
      '--bg-card': '#ffffff',
      '--bg-card-hover': '#f8fafc',
      '--accent': '#6366f1',
      '--accent-hover': '#4f46e5',
      '--text-primary': '#0f172a',
      '--text-secondary': '#475569',
      '--text-muted': '#94a3b8',
      '--border': 'rgba(99,102,241,0.15)',
      '--border-strong': 'rgba(99,102,241,0.3)',
      '--status-ok': '#10b981',
      '--status-warn': '#f59e0b',
      '--status-err': '#ef4444',
    },
  },
  {
    name: 'sap-horizon',
    label: 'SAP Horizon',
    description: 'Exact SAP Kyma dashboard theme — Horizon Light with SAP 72 font',
    preview: '#1d2d3e',
    vars: {
      '--bg-base': '#f5f6f7',
      '--bg-sidebar': '#ffffff',
      '--bg-card': '#ffffff',
      '--bg-card-hover': '#f5f6f7',
      '--accent': '#0070f2',
      '--accent-hover': '#0064d9',
      '--text-primary': '#32363a',
      '--text-secondary': '#556b82',
      '--text-muted': '#89919a',
      '--border': '#d9d9d9',
      '--border-strong': '#89919a',
      '--status-ok': '#107e3e',
      '--status-warn': '#e76500',
      '--status-err': '#bb0000',
      '--shell-bg': '#1d2d3e',
      '--shell-text': '#ffffff',
      '--table-header-bg': '#f2f4f7',
      '--table-row-hover': '#e7f0f7',
      '--nav-active-bg': '#e7f0f7',
      '--nav-active-color': '#0070f2',
      '--card-shadow': '0 0 0.125rem rgba(34,53,72,0.10), 0 0.5rem 1rem rgba(34,53,72,0.15)',
      '--font-family': '"72", "72full", Arial, Helvetica, sans-serif',
    },
  },
];

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'kyma-dark',
  setTheme: () => {},
  fontSize: 14,
  setFontSize: () => {},
});

export const FONT_SIZE_MIN = 20;
export const FONT_SIZE_MAX = 30;
export const FONT_SIZE_DEFAULT = 22;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem('sk-theme') as ThemeName) || 'kyma-dark';
  });

  const [fontSize, setFontSizeState] = useState<number>(() => {
    return parseInt(localStorage.getItem('sk-font-size') || '22', 10);
  });

  const setTheme = (t: ThemeName) => {
    setThemeState(t);
    localStorage.setItem('sk-theme', t);
  };

  const setFontSize = (size: number) => {
    const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, size));
    setFontSizeState(clamped);
    localStorage.setItem('sk-font-size', String(clamped));
  };

  useEffect(() => {
    const t = THEMES.find(x => x.name === theme) || THEMES[0];
    const root = document.documentElement;
    Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));

    // Apply font-family directly so it cascades before Tailwind base styles
    const fontFamily = t.vars['--font-family'];
    if (fontFamily) {
      root.style.setProperty('font-family', fontFamily);
      document.body.style.fontFamily = fontFamily;
    } else {
      root.style.removeProperty('font-family');
      document.body.style.fontFamily = '';
    }

    // Toggle theme class flags
    root.classList.toggle('theme-light', theme === 'light-pro');
    root.classList.toggle('theme-sap-horizon', theme === 'sap-horizon');
  }, [theme]);

  // Apply font size as CSS variable + direct style
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-size-base', `${fontSize}px`);
    document.body.style.fontSize = `${fontSize}px`;
  }, [fontSize]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

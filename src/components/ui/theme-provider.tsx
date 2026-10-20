'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggleTheme(): void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const manual = useRef(false);
  const apply = (next: Theme) => {
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    let saved: string | null = null;
    try { saved = localStorage.getItem('resolve-theme'); } catch { /* Storage is optional. */ }
    manual.current = saved === 'light' || saved === 'dark';
    apply(saved === 'light' || saved === 'dark' ? saved : media?.matches ? 'dark' : 'light');
    const systemChanged = () => { if (!manual.current) apply(media?.matches ? 'dark' : 'light'); };
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== 'resolve-theme') return;
      manual.current = event.newValue === 'dark' || event.newValue === 'light';
      apply(event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : media?.matches ? 'dark' : 'light');
    };
    media?.addEventListener?.('change', systemChanged);
    window.addEventListener('storage', storageChanged);
    return () => {
      media?.removeEventListener?.('change', systemChanged);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    manual.current = true;
    apply(next);
    try { localStorage.setItem('resolve-theme', next); } catch { /* Keep the selected theme in memory. */ }
  }
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider must wrap the application.');
  return context;
}

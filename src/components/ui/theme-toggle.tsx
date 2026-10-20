'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <button className="icon-button theme-toggle" onClick={toggleTheme}
    aria-label={`Use ${theme === 'light' ? 'dark' : 'light'} mode`}>
    {theme === 'light' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
  </button>;
}

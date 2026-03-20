import { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';

const SETTINGS_KEY = 'softbits_crm_settings';
const LEGACY_KEY = 'adminit_theme';

function getStoredTheme(): ThemeMode {
  try {
    // Check shared settings first
    const shared = localStorage.getItem(SETTINGS_KEY);
    if (shared) {
      const settings = JSON.parse(shared);
      const theme = settings.appearance?.theme;
      if (theme === 'dark' || theme === 'light' || theme === 'system') return theme;
    }
    // Fall back to legacy key
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'light' || legacy === 'dark') return legacy;
  } catch { /* ignore */ }
  return 'dark';
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

export function useTheme() {
  const [mode, setModeState] = useState<ThemeMode>(getStoredTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(getStoredTheme()));

  // Apply theme on mount and when mode changes
  useEffect(() => {
    const res = resolveTheme(mode);
    setResolved(res);
    applyTheme(res);
  }, [mode]);

  // Listen for system preference changes when in system mode
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const res = e.matches ? 'dark' : 'light';
      setResolved(res);
      applyTheme(res);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Listen for cross-tab settings changes
  useEffect(() => {
    const handler = () => {
      const stored = getStoredTheme();
      setModeState(stored);
    };
    window.addEventListener('settingsUpdated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('settingsUpdated', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const setTheme = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      // Save to shared settings
      const stored = localStorage.getItem(SETTINGS_KEY);
      const settings = stored ? JSON.parse(stored) : {};
      settings.appearance = settings.appearance || {};
      settings.appearance.theme = newMode;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      // Also save to legacy key for backwards compat
      localStorage.setItem(LEGACY_KEY, newMode === 'system' ? 'dark' : newMode);
      // Notify other components
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch { /* ignore */ }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }, [resolved, setTheme]);

  // Expose both mode (dark/light/system) and resolved (dark/light) for UI
  return { theme: resolved, mode, setTheme, toggleTheme };
}

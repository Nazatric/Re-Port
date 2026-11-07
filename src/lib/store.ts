import { useCallback, useSyncExternalStore } from 'react';
import type { Settings } from './types';

function createStore<T>(key: string, initial: T, sanitize: (v: unknown) => T) {
  const listeners = new Set<() => void>();
  const read = (): T => {
    try {
      const s = typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
      return s ? sanitize(JSON.parse(s)) : initial;
    } catch {
      return initial;
    }
  };
  let state = read();
  const emit = () => listeners.forEach((l) => l());
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === key) {
        state = read();
        emit();
      }
    });
  }
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === 'function' ? (next as (p: T) => T)(state) : next;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage may be unavailable (private mode); state still lives in memory */
      }
      emit();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

/* -------------------------------------------------------- settings */
export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  text: 0,
  motion: 'system',
  contrast: false,
  dataSaver: false,
  haptics: true,
  view: 'grid',
};

export function sanitizeSettings(v: unknown): Settings {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<Settings>;
  return {
    theme: o.theme === 'azure' || o.theme === 'graphite' || o.theme === 'lime' || o.theme === 'system' ? o.theme : 'system',
    text: o.text === 1 || o.text === 2 ? o.text : 0,
    motion: o.motion === 'reduce' || o.motion === 'full' ? o.motion : 'system',
    contrast: o.contrast === true,
    dataSaver: o.dataSaver === true,
    haptics: o.haptics !== false,
    view: o.view === 'list' ? 'list' : 'grid',
  };
}

export const settingsStore = createStore<Settings>('portdeck.settings.v1', DEFAULT_SETTINGS, sanitizeSettings);

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
  const update = useCallback((patch: Partial<Settings>) => settingsStore.set((p) => ({ ...p, ...patch })), []);
  return [s, update];
}

const THEME_COLORS = { lime: '#2f7d12', azure: '#0b4fb3', graphite: '#1b1e22' } as const;

export function resolveTheme(theme: Settings['theme'], systemDark: boolean): 'lime' | 'azure' | 'graphite' {
  if (theme === 'system') return systemDark ? 'graphite' : 'azure';
  return theme;
}

export function applySettings(s: Settings): void {
  const root = document.documentElement;
  const systemDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const theme = resolveTheme(s.theme, systemDark);
  root.dataset.theme = theme;
  root.dataset.themePreference = s.theme;
  root.dataset.contrast = String(s.contrast);
  const reduce = s.motion === 'reduce' || (s.motion === 'system' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  root.dataset.motion = reduce ? 'reduce' : 'full';
  root.style.fontSize = `${[100, 112, 125][s.text]}%`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
}

/* ------------------------------------------------------- id lists */
const sanitizeIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : []);

export const favoritesStore = createStore<string[]>('portdeck.saved.v1', [], sanitizeIds);
export const recentsStore = createStore<string[]>('portdeck.recent.v1', [], sanitizeIds);

export function useFavorites() {
  const ids = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.get, favoritesStore.get);
  return { ids, has: (id: string) => ids.includes(id) };
}

export function toggleFavorite(id: string): boolean {
  const has = favoritesStore.get().includes(id);
  favoritesStore.set((p) => (has ? p.filter((x) => x !== id) : [id, ...p]));
  return !has;
}

export function useRecents(): string[] {
  return useSyncExternalStore(recentsStore.subscribe, recentsStore.get, recentsStore.get);
}

export function addRecent(id: string): void {
  recentsStore.set((p) => [id, ...p.filter((x) => x !== id)].slice(0, 24));
}

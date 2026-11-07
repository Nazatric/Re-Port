import { useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';

export interface Route {
  path: string;
  seg: string[];
  query: URLSearchParams;
  raw: string;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const qi = h.indexOf('?');
  const pathPart = qi >= 0 ? h.slice(0, qi) : h;
  const query = new URLSearchParams(qi >= 0 ? h.slice(qi + 1) : '');
  const path = '/' + pathPart.split('/').filter(Boolean).join('/');
  const seg = path
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return { path, seg, query, raw: h };
}

export function buildHref(path: string, params?: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => v && qs.set(k, v));
  const s = qs.toString();
  return `#${path}${s ? `?${s}` : ''}`;
}

let backPending = false;
const subscribe = (cb: () => void) => {
  const onHash = () => cb();
  const onPop = () => {
    backPending = false;
    cb();
  };
  window.addEventListener('hashchange', onHash);
  window.addEventListener('popstate', onPop);
  return () => {
    window.removeEventListener('hashchange', onHash);
    window.removeEventListener('popstate', onPop);
  };
};

interface DeckHistoryState {
  portDeck?: true;
  idx?: number;
  [key: string]: unknown;
}

function ensureHistoryEntry(): void {
  if (!window.history.state?.portDeck) {
    window.history.replaceState({ ...(window.history.state || {}), portDeck: true, idx: 0 } satisfies DeckHistoryState, '', window.location.href);
  }
}

function notifyRouteChange(): void {
  window.dispatchEvent(new Event('popstate'));
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  useEffect(() => ensureHistoryEntry(), []);
  return useMemo(() => parseHash(hash), [hash]);
}

/* Keep history entries owned by this app explicit; never guess from the browser's global history length. */
let pending: 'push' | 'replace' | 'back' | 'keep' | null = null;

export function navigate(path: string, params?: Record<string, string | undefined>, opts: { replace?: boolean; keepScroll?: boolean } = {}): void {
  const target = buildHref(path, params);
  if (target === window.location.hash) return;
  ensureHistoryEntry();
  const state = window.history.state as DeckHistoryState;
  const idx = Number(state.idx) || 0;
  pending = opts.keepScroll ? 'keep' : opts.replace ? 'replace' : 'push';
  if (opts.replace) {
    window.history.replaceState({ ...state, portDeck: true, idx }, '', target);
  } else {
    window.history.pushState({ portDeck: true, idx: idx + 1 }, '', target);
  }
  notifyRouteChange();
}

/** Returns false when already at the supplied fallback. Native Android can then exit cleanly. */
export function goBack(fallback = '/'): boolean {
  const state = window.history.state as DeckHistoryState | null;
  if (state?.portDeck && Number(state.idx) > 0) {
    if (backPending) return true;
    backPending = true;
    pending = 'back';
    window.history.back();
    return true;
  }
  const target = buildHref(fallback);
  if (target !== window.location.hash) {
    navigate(fallback, undefined, { replace: true });
    return true;
  }
  return false;
}

function shouldHandleClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  const target = e.currentTarget.target;
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && (!target || target === '_self') && !e.currentTarget.hasAttribute('download');
}

export function Link({ to, params, children, onClick, ...rest }: { to: string; params?: Record<string, string | undefined>; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a
      href={buildHref(to, params)}
      onClick={(e) => {
        onClick?.(e);
        if (!shouldHandleClick(e)) return;
        e.preventDefault();
        navigate(to, params);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

/* ---------------------------------------------------- scroll memory */
const positions = new Map<string, number>();
let current = '';
export const pageMemory = new Map<string, number>();

if (typeof window !== 'undefined') {
  if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  window.addEventListener(
    'scroll',
    () => {
      if (current) positions.set(current, window.scrollY);
    },
    { passive: true },
  );
}

export function useScrollManager(route: Route): void {
  useLayoutEffect(() => {
    const kind = pending;
    pending = null;
    current = route.raw;
    if (kind === 'keep') return;
    const y = kind === 'push' || kind === 'replace' ? 0 : positions.get(route.raw) || 0;
    window.scrollTo(0, y);
    // Content such as infinite lists may not be tall enough yet; retry once after layout settles.
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [route.raw]);
}

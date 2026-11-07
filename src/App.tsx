import { useEffect, useRef, type ReactNode } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BottomNav } from './components/BottomNav';
import { DataSaverContext } from './components/Cover';
import { Icon } from './components/Icons';
import { Toaster } from './components/ui';
import About from './pages/About';
import Collections from './pages/Collections';
import Detail from './pages/Detail';
import Home from './pages/Home';
import Library from './pages/Library';
import NotFound from './pages/NotFound';
import Saved from './pages/Saved';
import Settings from './pages/Settings';
import Submit from './pages/Submit';
import { currentGenerated, gameById, games, useCatalogVersion } from './lib/catalog';
import { autoRefresh, rememberBundled, registerGenerated, warmFromCache } from './lib/remoteCatalog';
import { goBack, useRoute, useScrollManager, type Route } from './lib/router';
import { applySettings, useSettings } from './lib/store';
import { useOnline } from './lib/useOnline';

// Let the updater know which catalog build shipped with this app, so it can tell a real
// refresh from a redundant download.
rememberBundled(games.map((g) => g.id));
registerGenerated(currentGenerated);

const TITLES: Record<string, string> = {
  '': 'Re:Port - Unofficial Android Port Library',
  library: 'Library',
  collections: 'Browse',
  saved: 'Saved',
  settings: 'Settings',
  submit: 'Submit a port',
  about: 'About',
};

export function titleFor(route: Route): string {
  const first = route.seg[0] ?? '';
  if (first === 'game') return `${gameById.get(route.seg[1] ?? '')?.title ?? 'Game not found'} - Re:Port`;
  if (first === '') return TITLES[''];
  return `${TITLES[first] ?? 'Not found'} - Re:Port`;
}

function pageFor(route: Route): ReactNode {
  switch (route.seg[0] ?? '') {
    case '':
      return <Home />;
    case 'library':
      return <Library />;
    case 'game':
      return <Detail id={route.seg[1] ?? ''} />;
    case 'collections':
      return <Collections />;
    case 'saved':
      return <Saved />;
    case 'settings':
      return <Settings />;
    case 'submit':
      return <Submit />;
    case 'about':
      return <About />;
    default:
      return <NotFound />;
  }
}

export default function App() {
  const route = useRoute();
  const [settings] = useSettings();
  const online = useOnline();
  // Subscribe to catalog updates without remounting and reanimating the current page.
  useCatalogVersion();
  useScrollManager(route);
  const initialPath = useRef(route.path);
  const hasNavigated = useRef(false);
  if (route.path !== initialPath.current) hasNavigated.current = true;

  // Offline first: restore the last published catalog from cache, then quietly check for a newer one.
  useEffect(() => {
    void (async () => {
      await warmFromCache();
      await autoRefresh();
    })();
  }, []);
  const firstRender = useRef(true);

  useEffect(() => applySettings(settings), [settings]);
  useEffect(() => {
    if (settings.motion !== 'system' && settings.theme !== 'system') return;
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => applySettings(settings);
    dark.addEventListener?.('change', on);
    reduced.addEventListener?.('change', on);
    return () => {
      dark.removeEventListener?.('change', on);
      reduced.removeEventListener?.('change', on);
    };
  }, [settings.motion, settings.theme, settings.text, settings.contrast, settings.dataSaver, settings.haptics, settings.view]);

  // Capacitor's back event handles Android system gestures and hardware keys without guessing
  // from window.history.length (which includes pages outside this app). Resuming the app also
  // re-checks the published catalog, so an installed APK does not sit on an old library.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const track = (promise: Promise<{ remove: () => Promise<void> }>) => {
      void promise.then((listener) => {
        if (disposed) void listener.remove();
        else handles.push(listener);
      });
    };
    track(
      NativeApp.addListener('backButton', () => {
        if (document.querySelector('[aria-modal="true"]')) {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return;
        }
        if (!goBack('/')) void NativeApp.exitApp();
      }),
    );
    track(NativeApp.addListener('resume', () => void autoRefresh()));
    return () => {
      disposed = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, []);

  // Announce the new page to assistive tech and move focus to its heading.
  useEffect(() => {
    document.title = titleFor(route);
    // Keep the skip link as the first tab stop on a fresh load; move focus only on later navigations.
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const heading = document.getElementById('page-title');
    (heading ?? document.getElementById('main'))?.focus({ preventScroll: true });
  }, [route.path]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = route.seg[0] ?? '';
  return (
    <DataSaverContext.Provider value={settings.dataSaver}>
      <a
        href="#main"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </a>
      {!online && (
        <div role="status" className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+8px)] z-[90] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/80 px-4 py-2 text-xs font-bold text-white shadow-lg">
          <Icon name="cloudOff" size={16} />
          Offline. Saved artwork and the full catalog still work.
        </div>
      )}
      <div key={route.path} className={`page${hasNavigated.current ? (first === 'game' ? ' page-turn' : ' page-enter') : first === '' ? ' page-intro' : ''}`}>
        {pageFor(route)}
      </div>
      <BottomNav route={route} />
      <Toaster />
    </DataSaverContext.Provider>
  );
}

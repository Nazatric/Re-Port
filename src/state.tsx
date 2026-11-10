import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";

export type Tab = "home" | "browse" | "library" | "settings";
export type Route = { type: "game"; id: string } | { type: "collection"; name: string } | { type: "about" };
export type ThemeName = "nxe" | "meadow" | "sky" | "night";

export type AvatarPreset =
  | "initials"
  | "nxe"
  | "gamepad"
  | "dandelion"
  | "sword"
  | "crown"
  | "ghost"
  | "flame"
  | "bolt"
  | "planet"
  | "heart"
  | "shield";

export interface AvatarConfig {
  mode: "preset" | "image";
  preset: AvatarPreset;
  imageUrl: string;
}

export interface BrowsePreset {
  fileNeeds?: string[];
  onlyApk?: boolean;
}

export interface Settings {
  theme: ThemeName;
  nightVariant: "amoled" | "normal";
  animations: boolean;
  reflections: boolean;
  bubbles: boolean;
  autoplay: boolean;
  haptics: boolean;
}

const NAME_KEY = "report:name";
const AVATAR_KEY = "report:avatar";
const SETTINGS_KEY = "report:settings";
const SAVED_KEY = "report:saved";
const RECENT_KEY = "report:recent";
const VIEWS_KEY = "report:local-views";

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

const defaultSettings: Settings = { theme: "nxe", nightVariant: "amoled", animations: true, reflections: true, bubbles: true, autoplay: false, haptics: true };
export const defaultAvatar: AvatarConfig = { mode: "preset", preset: "gamepad", imageUrl: "" };

interface AppState {
  name: string;
  setName: (n: string) => void;
  avatar: AvatarConfig;
  setAvatar: (a: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)) => void;
  onboarded: boolean;
  finishOnboarding: (name: string, avatar?: AvatarConfig) => void;
  editNameOpen: boolean;
  setEditNameOpen: (v: boolean) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
  browsePreset: BrowsePreset | null;
  goBrowse: (preset?: BrowsePreset) => void;
  stack: Route[];
  push: (r: Route) => void;
  pop: () => void;
  settings: Settings;
  setSetting: <K extends keyof Settings>(k: K, v: Settings[K]) => void;
  saved: Set<string>;
  toggleSaved: (id: string) => void;
  recent: string[];
  localViews: Record<string, number>;
  visit: (id: string) => void;
  toast: string | null;
  toastKey: number;
  showToast: (m: string) => void;
  haptic: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [name, setNameRaw] = useState<string>(() => load<string>(NAME_KEY, ""));
  const [avatar, setAvatarState] = useState<AvatarConfig>(() => ({ ...defaultAvatar, ...load<Partial<AvatarConfig>>(AVATAR_KEY, {}) }));
  const [onboarded, setOnboarded] = useState(() => !!load<string>(NAME_KEY, ""));
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [tab, setTabRaw] = useState<Tab>("home");
  const [browsePreset, setBrowsePreset] = useState<BrowsePreset | null>(null);
  const [stack, setStack] = useState<Route[]>([]);
  const [settings, setSettings] = useState<Settings>(() => ({ ...defaultSettings, ...load<Partial<Settings>>(SETTINGS_KEY, {}) }));
  const [saved, setSaved] = useState<Set<string>>(() => new Set(load<string[]>(SAVED_KEY, [])));
  const [recent, setRecent] = useState<string[]>(() => load<string[]>(RECENT_KEY, []));
  const [localViews, setLocalViews] = useState<Record<string, number>>(() => load(VIEWS_KEY, {}));
  const [toast, setToast] = useState<string | null>(null);
  const [toastKey, setToastKey] = useState(0);

  useEffect(() => { save(SETTINGS_KEY, settings); }, [settings]);
  useEffect(() => { save(AVATAR_KEY, avatar); }, [avatar]);
  useEffect(() => { save(SAVED_KEY, [...saved]); }, [saved]);
  useEffect(() => { save(RECENT_KEY, recent); }, [recent]);
  useEffect(() => { save(VIEWS_KEY, localViews); }, [localViews]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast, toastKey]);

  const haptic = useCallback(() => {
    if (settings.haptics && typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(6); } catch { /* no vibrator */ }
    }
  }, [settings.haptics]);
  const showToast = useCallback((m: string) => { setToast(m); setToastKey((k) => k + 1); }, []);

  const setName = useCallback((n: string) => { const v = n.trim().slice(0, 20); setNameRaw(v); save(NAME_KEY, v); }, []);
  const setAvatar = useCallback((updater: AvatarConfig | ((prev: AvatarConfig) => AvatarConfig)) => {
    setAvatarState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      save(AVATAR_KEY, next);
      return next;
    });
  }, []);

  const finishOnboarding = useCallback((n: string, av?: AvatarConfig) => {
    const v = n.trim().slice(0, 20);
    if (!v) return;
    setNameRaw(v); save(NAME_KEY, v);
    if (av) { setAvatarState(av); save(AVATAR_KEY, av); }
    setOnboarded(true);
  }, []);
  const setTab = useCallback((t: Tab) => { haptic(); setTabRaw(t); }, [haptic]);
  const goBrowse = useCallback((preset?: BrowsePreset) => {
    haptic();
    setBrowsePreset(preset ?? null);
    setTabRaw("browse");
  }, [haptic]);
  const push = useCallback((r: Route) => { haptic(); setStack((s) => [...s, r]); }, [haptic]);
  const pop = useCallback(() => { haptic(); setStack((s) => s.slice(0, -1)); }, [haptic]);
  const setSetting = useCallback(<K extends keyof Settings>(k: K, v: Settings[K]) => {
    setSettings((s) => ({ ...s, [k]: v }));
  }, []);
  const toggleSaved = useCallback((id: string) => {
    haptic();
    setSaved((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); showToast("Removed from saved"); }
      else { n.add(id); showToast("Saved to your library"); }
      return n;
    });
  }, [haptic, showToast]);
  const visit = useCallback((id: string) => {
    setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 24));
    setLocalViews((v) => ({ ...v, [id]: (v[id] || 0) + 1 }));
  }, []);

  const value = useMemo<AppState>(() => ({
    name, setName, avatar, setAvatar, onboarded, finishOnboarding, editNameOpen, setEditNameOpen,
    tab, setTab, browsePreset, goBrowse, stack, push, pop, settings, setSetting, saved, toggleSaved, recent, localViews, visit,
    toast, toastKey, showToast, haptic,
  }), [name, setName, avatar, setAvatar, onboarded, finishOnboarding, editNameOpen, tab, setTab, browsePreset, goBrowse, stack, push, pop, settings, setSetting, saved, toggleSaved, recent, localViews, visit, toast, toastKey, showToast, haptic]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

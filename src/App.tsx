import { useEffect, useRef, useState, type AnimationEvent } from "react";
import { BatteryMedium, Signal, Wifi } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";
import { openExternal } from "./lib/external";
import { AppProvider, useApp, type Route, type Tab } from "./state";
import { cn } from "./utils/cn";
import { Background } from "./components/Background";
import { BottomNav } from "./components/BottomNav";
import { Home } from "./screens/Home";
import { Browse } from "./screens/Browse";
import { Library } from "./screens/Library";
import { NamePrompt, SettingsScreen } from "./screens/Settings";
import { GameDetail } from "./screens/GameDetail";
import { AboutPage, CollectionPage } from "./screens/Pages";

const TABS: Tab[] = ["home", "browse", "library", "settings"];

const renderTab = (t: Tab) => {
  switch (t) {
    case "home": return <Home />;
    case "browse": return <Browse />;
    case "library": return <Library />;
    case "settings": return <SettingsScreen />;
  }
};
const renderRoute = (r: Route) => {
  switch (r.type) {
    case "game": return <GameDetail id={r.id} />;
    case "collection": return <CollectionPage name={r.name} />;
    case "about": return <AboutPage />;
  }
};

function useMedia(q: string) {
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, [q]);
  return m;
}

function TabLayers({ pushed }: { pushed: boolean }) {
  const { tab } = useApp();
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));
  useEffect(() => {
    setVisited((previous) => previous.has(tab) ? previous : new Set([...previous, tab]));
  }, [tab]);
  return <div className="absolute inset-0 transition-transform duration-[520ms]" style={{ transform: pushed ? "translate3d(-5%,0,0) scale(.97)" : "translate3d(0,0,0) scale(1)", transitionTimingFunction: "var(--ease-out-expo)" }}>
    <div className="pointer-events-none absolute inset-0 z-10 bg-black transition-opacity duration-[520ms]" style={{ opacity: pushed ? 0.14 : 0 }} />
    {TABS.map((t) => {
      const active = t === tab;
      if (!active && !visited.has(t)) return null;
      return <div key={t} aria-hidden={!active} className={cn("absolute inset-0 transition-[opacity,transform] duration-[420ms]", active ? "opacity-100" : "tab-hidden pointer-events-none opacity-0")}
        style={{ transform: active ? "translate3d(0,0,0) scale(1)" : "translate3d(0,12px,0) scale(.985)", transitionTimingFunction: "var(--ease-out-expo)" }}>
        {renderTab(t)}
      </div>;
    })}
  </div>;
}

interface Rendered { key: number; route: Route; closing: boolean }
function RouteStack() {
  const { stack } = useApp();
  const keys = useRef<number[]>([]);
  const counter = useRef(0);
  const [rendered, setRendered] = useState<Rendered[]>([]);
  useEffect(() => {
    const k = keys.current;
    while (k.length < stack.length) k.push(++counter.current);
    const removed = k.splice(stack.length);
    setRendered((prev) => {
      const live = stack.map((route, i) => ({ key: k[i], route, closing: false }));
      const closing = prev.filter((p) => p.closing || removed.includes(p.key)).map((p) => ({ ...p, closing: true }));
      return [...live, ...closing];
    });
  }, [stack]);
  const onEnd = (r: Rendered) => (e: AnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !r.closing) return;
    setRendered((prev) => prev.filter((p) => p.key !== r.key));
  };
  return <>{rendered.map((r, i) => (
    <div key={r.key} onAnimationEnd={onEnd(r)} className={cn("absolute inset-0 overflow-hidden bg-white", r.closing ? "anim-push-out" : "anim-push-in")} style={{ zIndex: 50 + i, boxShadow: "-18px 0 44px -18px rgba(0,0,0,.3)" }}>
      <Background quiet />
      <div className="relative h-full">{renderRoute(r.route)}</div>
    </div>
  ))}</>;
}

function Toast() {
  const { toast, toastKey } = useApp();
  if (!toast) return null;
  return <div key={toastKey} className="anim-toast glass-dark pointer-events-none absolute bottom-[110px] left-1/2 z-[90] max-w-[88%] truncate rounded-full px-4 py-2.5 text-[13px] font-semibold text-white">{toast}</div>;
}

function StatusBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 20000); return () => clearInterval(t); }, []);
  return <div className="statusbar pointer-events-none absolute inset-x-0 top-0 z-[100] flex h-[30px] items-center justify-between px-6 text-[12px] font-semibold text-ink tabular-nums">
    <span className="t-white-shadow">{String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}</span>
    <span className="flex items-center gap-1.5 text-ink/80"><Wifi size={13} /><Signal size={13} /><BatteryMedium size={16} /></span>
  </div>;
}

function Shell() {
  const { stack, pop, tab, setTab, settings, onboarded, editNameOpen, setEditNameOpen, setName, setAvatar, showToast } = useApp();
  const framed = useMedia("(min-width: 540px) and (min-height: 700px)") && !Capacitor.isNativePlatform();
  const pushed = stack.length > 0;
  const modalOpen = editNameOpen;
  const depth = useRef(0);

  // Keep the browser/system status bar in sync with the selected theme.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", settings.theme === "night" ? "#04101F" : "#8CC63E");
  }, [settings.theme]);

  useEffect(() => {
    if (stack.length > depth.current) history.pushState({ report: stack.length }, "");
    depth.current = stack.length;
  }, [stack.length]);
  useEffect(() => {
    const onPop = () => { if (depth.current > 0 && !modalOpen) pop(); else if (!modalOpen) history.pushState(null, ""); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editNameOpen) { setEditNameOpen(false); return; }
        if (!onboarded) return;
        if (depth.current > 0) pop();
      }
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("popstate", onPop); window.removeEventListener("keydown", onKey); };
  }, [pop, modalOpen, editNameOpen, onboarded, setEditNameOpen]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = NativeApp.addListener("backButton", () => {
      const closeFilters = document.querySelector<HTMLButtonElement>('[aria-label="Close filters"]');
      if (closeFilters && !closeFilters.closest('[aria-hidden="true"]')) { closeFilters.click(); return; }
      if (editNameOpen) { setEditNameOpen(false); return; }
      if (!onboarded) return;
      if (stack.length) { pop(); return; }
      if (tab !== "home") { setTab("home"); return; }
      void NativeApp.exitApp();
    });
    return () => { void listener.then((handle) => handle.remove()); };
  }, [stack.length, pop, tab, setTab, editNameOpen, setEditNameOpen, onboarded]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const onLink = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[target="_blank"]');
      if (!link) return;
      event.preventDefault();
      void openExternal(link.href).catch(() => showToast("Could not open the link"));
    };
    document.addEventListener("click", onLink);
    return () => document.removeEventListener("click", onLink);
  }, [showToast]);

  return <div className={cn("device-stage", Capacitor.isNativePlatform() && "native-stage")}>
    <div className={cn("device", !settings.animations && "reduce-motion")} data-theme={settings.theme} data-night-variant={settings.nightVariant} style={{ ["--sat" as string]: framed ? "30px" : "env(safe-area-inset-top)", ["--sab" as string]: framed ? "0px" : "env(safe-area-inset-bottom)" }}>
      <Background />
      <TabLayers pushed={pushed} />
      <div className="absolute inset-x-0 bottom-0 z-40 transition-[transform,opacity] duration-[480ms]" style={{ transform: pushed ? "translate3d(0,110%,0)" : "translate3d(0,0,0)", opacity: pushed ? 0 : 1, transitionTimingFunction: "var(--ease-out-expo)" }}><BottomNav /></div>
      <RouteStack />
      <Toast />
      {framed && <StatusBar />}
      {onboarded && editNameOpen && (
        <NamePrompt
          firstRun={false}
          onDone={(n, av) => {
            if (n) setName(n);
            if (av) setAvatar(av);
            setEditNameOpen(false);
          }}
        />
      )}
    </div>
  </div>;
}

export default function App() { return <AppProvider><Shell /></AppProvider>; }

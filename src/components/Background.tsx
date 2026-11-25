import { memo, useEffect, useMemo, useState } from "react";
import { useApp } from "@/state";
import skyScene from "@/assets/theme/sky.webp";
import meadowScene from "@/assets/theme/meadow.webp";

interface Bubble { x: number; y: number; size: number; dur: number; delay: number; sway: number; op: number; filled: boolean }
function seeded(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/** The viewport shrinks when the on-screen keyboard opens. A background sized to the shrunken viewport
 *  re-crops its artwork, so the sun and clouds jumped. Keep the tallest height seen at this width. */
function useStableHeight(): number {
  const [h, setH] = useState(() => (typeof window === "undefined" ? 0 : window.innerHeight));
  useEffect(() => {
    let width = window.innerWidth;
    const onResize = () => {
      if (window.innerWidth !== width) { width = window.innerWidth; setH(window.innerHeight); return; }
      setH((prev) => Math.max(prev, window.innerHeight));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return h;
}

/** Static vector backdrops. NXE stays graphic; Meadow and Sky are rich nature
 *  scenes (sun glow, layered clouds, mountains, meadows). Bubbles only animate
 *  on the home shell so long lists stay GPU-cheap. */
function BackgroundInner({ quiet = false }: { quiet?: boolean }) {
  const { settings } = useApp();
  const bubbles = useMemo<Bubble[]>(() => {
    const r = seeded(42);
    return Array.from({ length: 14 }, (_, i) => ({
      x: r() * 100, y: 34 + r() * 70, size: 8 + r() * (i % 5 === 0 ? 84 : 36),
      dur: 18 + r() * 20, delay: -r() * 30, sway: (r() - 0.5) * 48,
      op: 0.22 + r() * 0.4, filled: i % 3 === 1,
    }));
  }, []);
  const theme = settings.theme;
  // AMOLED keeps the full Night scene (stars, aurora, bubbles) but dims it over true black.
  const amoled = theme === "night" && settings.nightVariant === "amoled";
  // Plain white star dots only: AMOLED has no tinted layers.
  const stars = useMemo(() => {
    const r = seeded(7);
    return Array.from({ length: 70 }, () => ({ x: r() * 412, y: r() * 892, r: 0.5 + r() * 1.1, o: 0.25 + r() * 0.6 }));
  }, []);
  const animate = settings.animations && !quiet && settings.bubbles;
  const stableHeight = useStableHeight();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" aria-hidden
      style={stableHeight ? { height: stableHeight, bottom: "auto" } : undefined}>
      {theme === "nxe" ? (
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#d9f183 0%,#b7e23e 34%,#8cc63e 68%,#639f24 100%)" }} />
      ) : amoled ? (
        <svg viewBox="0 0 412 892" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <rect width="412" height="892" fill="#000" />
          <g fill="#fff">
            {stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} opacity={st.o} />)}
          </g>
        </svg>
      ) : theme === "night" ? (
        <svg viewBox="0 0 412 892" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full" style={{ transform: "translateZ(0)" }}>
          <defs>
            <linearGradient id="rp-night" x1="0" y1="0" x2="0.25" y2="1">
              <stop offset="0" stopColor="#020813" /><stop offset=".28" stopColor="#06182f" />
              <stop offset=".6" stopColor="#0a2c50" /><stop offset=".82" stopColor="#0d4063" /><stop offset="1" stopColor="#041426" />
            </linearGradient>
            <radialGradient id="rp-nhalo" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#8ee8ff" stopOpacity=".48" /><stop offset=".45" stopColor="#2aa8e8" stopOpacity=".18" /><stop offset="1" stopColor="#2aa8e8" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="rp-nbore" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#bff6ff" stopOpacity=".85" /><stop offset=".35" stopColor="#63e1d0" stopOpacity=".35" /><stop offset="1" stopColor="#63e1d0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rp-aurora1" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4bd8ff" stopOpacity="0" /><stop offset=".35" stopColor="#57e6c4" stopOpacity=".34" />
              <stop offset=".7" stopColor="#7aa8ff" stopOpacity=".26" /><stop offset="1" stopColor="#a072ff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rp-aurora2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8b6bff" stopOpacity="0" /><stop offset=".4" stopColor="#4ad9ff" stopOpacity=".22" />
              <stop offset=".75" stopColor="#5ff0c8" stopOpacity=".3" /><stop offset="1" stopColor="#5ff0c8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="rp-horizon" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7de3ff" stopOpacity="0" /><stop offset="1" stopColor="#7de3ff" stopOpacity=".2" />
            </linearGradient>
          </defs>
          <rect width="412" height="892" fill={amoled ? "#000" : "url(#rp-night)"} />
          {/* deep luminous glows */}
          <circle cx="330" cy="150" r="220" fill="url(#rp-nhalo)" />
          <circle cx="70" cy="520" r="190" fill="url(#rp-nbore)" opacity=".55" />
          <circle cx="300" cy="700" r="220" fill="url(#rp-nhalo)" opacity=".7" />
          {/* Aero aurora ribbons */}
          <path d="M-40 250 C 70 150 150 320 260 230 S 400 170 460 250 L460 360 C 380 280 320 390 220 330 S 80 270 -40 360 Z" fill="url(#rp-aurora1)" />
          <path d="M-40 420 C 90 330 180 500 300 400 S 420 340 460 410 L460 500 C 380 430 320 540 210 480 S 70 430 -40 510 Z" fill="url(#rp-aurora2)" opacity=".8" />
          <path d="M-40 620 C 100 540 180 690 300 610 S 410 560 460 620 L460 690 C 380 630 300 730 200 680 S 70 640 -40 700 Z" fill="url(#rp-aurora1)" opacity=".55" />
          {/* curved Aero light streaks */}
          <g fill="none" strokeLinecap="round">
            <path d="M-30 300 C 90 190 170 350 280 260 S 400 210 440 270" stroke="#8ceeff" strokeWidth="1.4" opacity=".38" />
            <path d="M-30 470 C 100 380 190 540 310 450 S 410 400 440 460" stroke="#7bf0d0" strokeWidth="1.2" opacity=".3" />
            <path d="M-30 650 C 100 570 190 710 310 630 S 410 590 440 640" stroke="#8ceeff" strokeWidth="1" opacity=".24" />
          </g>
          {/* star field */}
          <g fill="#dff6ff">
            <circle cx="38" cy="72" r="1.3" opacity=".8" /><circle cx="92" cy="128" r="1" opacity=".6" />
            <circle cx="146" cy="58" r="1.6" opacity=".9" /><circle cx="212" cy="96" r="1" opacity=".55" />
            <circle cx="268" cy="44" r="1.4" opacity=".8" /><circle cx="352" cy="82" r="1" opacity=".6" />
            <circle cx="384" cy="168" r="1.5" opacity=".85" /><circle cx="60" cy="212" r="1" opacity=".5" />
            <circle cx="124" cy="268" r="1.3" opacity=".7" /><circle cx="208" cy="196" r="1" opacity=".6" />
            <circle cx="300" cy="240" r="1.2" opacity=".7" /><circle cx="364" cy="312" r="1" opacity=".55" />
            <circle cx="28" cy="360" r="1.3" opacity=".7" /><circle cx="96" cy="420" r="1" opacity=".5" />
            <circle cx="176" cy="386" r="1.4" opacity=".8" /><circle cx="248" cy="452" r="1" opacity=".6" />
            <circle cx="336" cy="420" r="1.2" opacity=".7" /><circle cx="392" cy="500" r="1" opacity=".5" />
            <circle cx="48" cy="560" r="1.3" opacity=".7" /><circle cx="142" cy="612" r="1" opacity=".55" />
            <circle cx="222" cy="580" r="1.5" opacity=".8" /><circle cx="312" cy="650" r="1" opacity=".6" />
            <circle cx="380" cy="720" r="1.2" opacity=".7" />
          </g>
          {/* four-point Aero sparkles */}
          <g>
            <circle cx="310" cy="118" r="20" fill="url(#rp-nbore)" opacity=".55" />
            <circle cx="72" cy="300" r="16" fill="url(#rp-nbore)" opacity=".45" />
            <circle cx="356" cy="570" r="18" fill="url(#rp-nbore)" opacity=".45" />
            <g fill="#ffffff">
              <path d="M310 104 L312 116 L324 118 L312 120 L310 132 L308 120 L296 118 L308 116 Z" opacity=".9" />
              <path d="M72 289 L74 298 L83 300 L74 302 L72 311 L70 302 L61 300 L70 298 Z" opacity=".7" />
              <path d="M356 556 L358 568 L370 570 L358 572 L356 584 L354 572 L342 570 L354 568 Z" opacity=".76" />
            </g>
          </g>
          {/* Aero glass bokeh */}
          <g fill="none" stroke="#bdefff">
            <circle cx="60" cy="180" r="34" strokeWidth="1.2" opacity=".16" />
            <circle cx="330" cy="350" r="52" strokeWidth="1.4" opacity=".14" />
            <circle cx="120" cy="500" r="26" strokeWidth="1.2" opacity=".18" />
            <circle cx="288" cy="760" r="66" strokeWidth="1.4" opacity=".13" />
            <circle cx="380" cy="612" r="18" strokeWidth="1.2" opacity=".2" />
          </g>
          <g fill="#bff2ff" opacity=".1">
            <circle cx="330" cy="350" r="38" /><circle cx="288" cy="760" r="48" /><circle cx="60" cy="180" r="22" />
          </g>
          {/* luminous horizon + dark vignette */}
          <rect y="700" width="412" height="192" fill="url(#rp-horizon)" />
          <path d="M0 820 Q 120 770 240 812 T 412 790 V892 H0 Z" fill="#020a16" opacity=".55" />
          <path d="M0 852 Q 140 812 260 846 T 412 832 V892 H0 Z" fill="#01060f" opacity=".7" />
        </svg>
      ) : (
        // Sky and Meadow: painted scenes (src/assets/theme). The image fills the screen and is
        // cropped from the bottom, so the horizon stays put when the keyboard shrinks the viewport.
        <img src={theme === "sky" ? skyScene : meadowScene} alt="" draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover object-bottom" />
      )}
      {theme === "nxe" && (
        <div
          className="absolute left-1/2 top-[30%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,255,175,.9) 0%, rgba(240,250,120,.4) 32%, rgba(200,236,80,0) 70%)" }}
        />
      )}
      {animate && bubbles.map((b, i) => (
        <span key={i} className="bubble absolute block rounded-full" style={{
          left: `${b.x}%`, top: `${b.y}%`, width: b.size, height: b.size,
          border: b.filled ? "none" : "1.5px solid rgba(255,255,255,.85)",
          background: b.filled ? "rgba(255,255,255,.5)" : "transparent",
          ["--sway" as string]: `${b.sway}px`, ["--op" as string]: b.op,
          animation: `bubble-float ${b.dur}s linear ${b.delay}s infinite, bubble-fade ${b.dur}s linear ${b.delay}s infinite`,
        }} />
      ))}
      <div className="bg-floor-haze absolute inset-x-0 bottom-0 h-36" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,.45))" }} />
    </div>
  );
}

export const Background = memo(BackgroundInner);

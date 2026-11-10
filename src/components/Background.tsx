import { useMemo } from "react";
import { useApp } from "@/state";

interface Bubble { x: number; y: number; size: number; dur: number; delay: number; sway: number; op: number; filled: boolean }
function seeded(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

/** Static vector backdrops. NXE stays graphic; Meadow and Sky are rich nature
 *  scenes (sun glow, layered clouds, mountains, meadows). Bubbles only animate
 *  on the home shell so long lists stay GPU-cheap. */
export function Background({ quiet = false }: { quiet?: boolean }) {
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
  const animate = settings.animations && !quiet && settings.bubbles;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {theme === "nxe" ? (
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg,#d9f183 0%,#b7e23e 34%,#8cc63e 68%,#639f24 100%)" }} />
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
          <rect width="412" height="892" fill="url(#rp-night)" />
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
      ) : theme === "sky" ? (
        <svg viewBox="0 0 412 892" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="rp-skyg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3f9de0" /><stop offset=".38" stopColor="#7cc3f2" />
              <stop offset=".68" stopColor="#c9e9ff" /><stop offset=".9" stopColor="#f2fbff" /><stop offset="1" stopColor="#ffffff" />
            </linearGradient>
            <radialGradient id="rp-sun" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fffdf4" stopOpacity=".95" /><stop offset=".35" stopColor="#fff6cf" stopOpacity=".55" /><stop offset="1" stopColor="#fff6cf" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="412" height="892" fill="url(#rp-skyg)" />
          <circle cx="316" cy="128" r="150" fill="url(#rp-sun)" />
          <circle cx="316" cy="128" r="34" fill="#fffef8" opacity=".95" />
          {/* high cirrus streaks */}
          <g stroke="#ffffff" strokeLinecap="round" opacity=".55">
            <path d="M40 210 Q 130 196 220 206" strokeWidth="7" fill="none" />
            <path d="M180 250 Q 280 240 360 248" strokeWidth="5" fill="none" opacity=".7" />
          </g>
          {/* cumulus with shaded bases */}
          <g fill="#ffffff">
            <g opacity=".95">
              <ellipse cx="104" cy="330" rx="58" ry="20" /><ellipse cx="70" cy="318" rx="30" ry="15" /><ellipse cx="138" cy="316" rx="28" ry="14" />
              <ellipse cx="104" cy="336" rx="58" ry="10" fill="#dcefff" opacity=".8" />
            </g>
            <g opacity=".85">
              <ellipse cx="310" cy="430" rx="66" ry="20" /><ellipse cx="272" cy="418" rx="30" ry="14" /><ellipse cx="346" cy="416" rx="28" ry="13" />
              <ellipse cx="310" cy="436" rx="62" ry="9" fill="#dcefff" opacity=".8" />
            </g>
            <g opacity=".7">
              <ellipse cx="120" cy="540" rx="52" ry="15" /><ellipse cx="152" cy="530" rx="26" ry="11" />
            </g>
            <g opacity=".55">
              <ellipse cx="300" cy="640" rx="56" ry="13" />
            </g>
          </g>
          {/* distant birds */}
          <g stroke="#5b7a99" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".65">
            <path d="M150 300 q6 -6 12 0 q6 -6 12 0" />
            <path d="M196 322 q5 -5 10 0 q5 -5 10 0" />
            <path d="M262 288 q5 -5 10 0 q5 -5 10 0" />
          </g>
          {/* horizon haze */}
          <rect y="760" width="412" height="132" fill="#ffffff" opacity=".35" />
        </svg>
      ) : (
        <svg viewBox="0 0 412 892" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="rp-msky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4aa8f0" /><stop offset=".42" stopColor="#8fcdf8" />
              <stop offset=".68" stopColor="#d5efff" /><stop offset="1" stopColor="#f2fbee" />
            </linearGradient>
            <radialGradient id="rp-msun" cx=".5" cy=".5" r=".5">
              <stop offset="0" stopColor="#fffdf2" stopOpacity=".95" /><stop offset=".4" stopColor="#fff3c2" stopOpacity=".5" /><stop offset="1" stopColor="#fff3c2" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="rp-mhill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a5d95c" /><stop offset="1" stopColor="#5f9f22" /></linearGradient>
            <linearGradient id="rp-mhill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8cc63e" /><stop offset="1" stopColor="#4c8a1a" /></linearGradient>
          </defs>
          <rect width="412" height="892" fill="url(#rp-msky)" />
          {/* sun + glow */}
          <circle cx="92" cy="96" r="150" fill="url(#rp-msun)" />
          <circle cx="92" cy="96" r="30" fill="#fffdf0" opacity=".95" />
          <circle cx="150" cy="70" r="6" fill="#fff" opacity=".5" />
          <circle cx="40" cy="150" r="4" fill="#fff" opacity=".5" />
          {/* distant mountains */}
          <path d="M0 620 L70 540 L130 600 L200 520 L280 606 L340 548 L412 612 V700 H0 Z" fill="#9dc3e8" opacity=".85" />
          <path d="M0 620 L70 540 L130 600 L200 520 L280 606 L340 548 L412 612" fill="none" stroke="#ffffff" strokeWidth="3" opacity=".6" />
          {/* clouds */}
          <g fill="#ffffff">
            <g opacity=".94">
              <ellipse cx="298" cy="180" rx="62" ry="20" /><ellipse cx="262" cy="168" rx="32" ry="15" /><ellipse cx="332" cy="166" rx="28" ry="13" />
              <ellipse cx="298" cy="186" rx="60" ry="10" fill="#d8efff" opacity=".85" />
            </g>
            <g opacity=".78">
              <ellipse cx="90" cy="290" rx="54" ry="16" /><ellipse cx="122" cy="278" rx="28" ry="12" />
              <ellipse cx="90" cy="295" rx="52" ry="8" fill="#d8efff" opacity=".8" />
            </g>
            <g opacity=".85">
              <ellipse cx="330" cy="392" rx="66" ry="18" /><ellipse cx="294" cy="380" rx="30" ry="12" />
            </g>
            <g opacity=".6"><ellipse cx="130" cy="486" rx="50" ry="13" /></g>
          </g>
          {/* birds */}
          <g stroke="#4a6b8a" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".6">
            <path d="M170 250 q6 -6 12 0 q6 -6 12 0" />
            <path d="M216 272 q5 -5 10 0 q5 -5 10 0" />
          </g>
          {/* rolling hills */}
          <path d="M0 668 Q 110 610 226 660 T 412 642 V892 H0 Z" fill="#b9e387" />
          <path d="M0 700 Q 110 640 226 690 T 412 672 V892 H0 Z" fill="#a5d95c" />
          <path d="M0 700 Q 110 640 226 690 T 412 672" fill="none" stroke="#ffffff" strokeWidth="3" opacity=".45" />
          <path d="M0 760 Q 140 700 268 752 T 412 736 V892 H0 Z" fill="url(#rp-mhill)" />
          <path d="M0 828 Q 120 782 240 820 T 412 806 V892 H0 Z" fill="url(#rp-mhill2)" />
          {/* grass tufts + flowers */}
          <g stroke="#3f7a16" strokeWidth="2.4" strokeLinecap="round" opacity=".8">
            <path d="M60 800 l-4 -12 M60 800 l0 -14 M60 800 l4 -12" />
            <path d="M180 846 l-4 -12 M180 846 l0 -14 M180 846 l4 -12" />
            <path d="M300 812 l-4 -12 M300 812 l0 -14 M300 812 l4 -12" />
            <path d="M120 872 l-4 -10 M120 872 l0 -12 M120 872 l4 -10" />
            <path d="M250 872 l-4 -10 M250 872 l0 -12 M250 872 l4 -10" />
          </g>
          <g>
            <circle cx="96" cy="836" r="4" fill="#fff" /><circle cx="96" cy="836" r="1.6" fill="#f6c945" />
            <circle cx="222" cy="798" r="4" fill="#fff" /><circle cx="222" cy="798" r="1.6" fill="#f6c945" />
            <circle cx="336" cy="850" r="4" fill="#fff" /><circle cx="336" cy="850" r="1.6" fill="#f6c945" />
            <circle cx="150" cy="818" r="3" fill="#f6c945" />
            <circle cx="272" cy="838" r="3" fill="#f6c945" />
          </g>
          {/* dandelion seeds */}
          <g stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" opacity=".9">
            <g transform="translate(318 500) rotate(18)">
              <line x1="0" y1="0" x2="0" y2="12" />
              <path d="M0 0 L-6 -7 M0 0 L0 -9 M0 0 L6 -7 M0 0 L-3 -8.5 M0 0 L3 -8.5" fill="none" />
            </g>
            <g transform="translate(70 590) rotate(-14) scale(0.8)">
              <line x1="0" y1="0" x2="0" y2="12" />
              <path d="M0 0 L-6 -7 M0 0 L0 -9 M0 0 L6 -7 M0 0 L-3 -8.5 M0 0 L3 -8.5" fill="none" />
            </g>
            <g transform="translate(210 650) rotate(30) scale(0.65)">
              <line x1="0" y1="0" x2="0" y2="12" />
              <path d="M0 0 L-6 -7 M0 0 L0 -9 M0 0 L6 -7" fill="none" />
            </g>
          </g>
        </svg>
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

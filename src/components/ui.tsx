import { type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { useApp, type AvatarConfig, type AvatarPreset, type Settings } from "@/state";
import type { Game } from "@/data/ports";
import { GameArt } from "./Artwork";

type Tint = "white" | "lime" | "blue" | "dark" | "amber";
const tintClass: Record<Tint, string> = { white: "glass", lime: "glass-lime", blue: "glass-blue", dark: "glass-dark", amber: "glass-amber" };

export function Glass({ tint = "white", sheen = true, className, style, onClick, children }: {
  tint?: Tint; sheen?: boolean; className?: string; style?: CSSProperties; onClick?: () => void; children?: ReactNode;
}) {
  return <div onClick={onClick} style={style} className={cn(tintClass[tint], sheen && "sheen", onClick && "press cursor-pointer", className)}>{children}</div>;
}

export function GlossButton({ variant = "lime", size = "md", icon: Icon, className, onClick, children, disabled }: {
  variant?: "lime" | "white" | "blue" | "amber"; size?: "sm" | "md" | "lg"; icon?: LucideIcon;
  className?: string; onClick?: () => void; children?: ReactNode; disabled?: boolean;
}) {
  const fg = variant === "white" ? "text-ink" : "text-white";
  const base = variant === "lime" ? "glass-lime" : variant === "blue" ? "glass-blue" : variant === "amber" ? "glass-amber" : "glass";
  const sizeCls = size === "sm" ? "h-9 px-3 text-[12px] gap-1.5" : size === "lg" ? "h-12 px-6 text-[15px] gap-2" : "h-10 px-4 text-[13px] gap-2";
  return (
    <button disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick?.(); }} className={cn("sheen press relative inline-flex min-h-9 items-center justify-center rounded-full font-semibold whitespace-nowrap select-none", base, fg, sizeCls, disabled && "opacity-60 pointer-events-none", className)}>
      {Icon && <Icon size={size === "sm" ? 14 : 17} strokeWidth={2.4} className="relative z-[2]" />}
      <span className="relative z-[2]">{children}</span>
    </button>
  );
}

export function IconButton({ icon: Icon, onClick, className, size = 44 }: { icon: LucideIcon; onClick?: () => void; className?: string; size?: number }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} style={{ width: size, height: size }} className={cn("glass sheen press relative grid place-items-center rounded-full text-ink", className)}><Icon size={size * 0.45} strokeWidth={2.2} className="relative z-[2]" /></button>;
}

export function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={(e) => { e.stopPropagation(); onChange(!checked); }} className="relative h-[32px] w-[56px] shrink-0 rounded-full transition-colors duration-300"
      style={{ background: checked ? "linear-gradient(180deg,#a9df52,#7dbb2c)" : "linear-gradient(180deg,#e9e9e9,#c7c7c7)", boxShadow: "inset 0 2px 4px rgba(0,0,0,.28), inset 0 -1px 0 rgba(255,255,255,.7), 0 1px 0 rgba(255,255,255,.8)" }}>
      <span className={cn("absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-white transition-opacity duration-300", checked ? "opacity-100" : "opacity-0")}>ON</span>
      <span className={cn("absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#8a8a8a] transition-opacity duration-300", checked ? "opacity-0" : "opacity-100")}>OFF</span>
      <span className="absolute left-[3px] top-[3px] h-[26px] w-[26px] rounded-full" style={{ transform: `translateX(${checked ? 24 : 0}px)`, transition: "transform 320ms var(--ease-spring)", background: "linear-gradient(180deg,#fff,#e4e4e4)", boxShadow: "0 2px 4px rgba(0,0,0,.35)" }} />
    </button>
  );
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} className={cn("press relative min-h-9 shrink-0 rounded-full px-3.5 text-[12.5px] font-semibold transition-colors", active ? "glass-lime sheen text-white" : "glass text-ink-soft", className)}><span className="relative z-[2]">{children}</span></button>;
}

export function SectionHeader({ title, action, onAction, className }: { title: string; action?: string; onAction?: () => void; className?: string }) {
  return <div className={cn("mb-2.5 flex items-end justify-between px-1", className)}>
    <h2 className="text-[17px] font-semibold tracking-tight text-ink t-white-shadow">{title}</h2>
    {action && <button onClick={onAction} className="press flex min-h-9 items-center gap-0.5 text-[12.5px] font-semibold text-azure">{action}<ChevronRight size={14} strokeWidth={2.5} /></button>}
  </div>;
}

export function BackHeader({ title, right }: { title?: string; right?: ReactNode }) {
  const { pop } = useApp();
  return <div className="sticky top-0 z-30 flex items-center gap-3 px-4 pb-2 pt-[calc(var(--sat)+12px)]">
    <IconButton icon={ChevronLeft} onClick={pop} />
    <div className="t-white-shadow flex-1 truncate text-[17px] font-semibold text-ink">{title}</div>
    {right}
  </div>;
}

export function GameIcon({ game, size = 64, className, radius }: { game: Game; size?: number; className?: string; radius?: number }) {
  return <GameArt game={game} radius={radius ?? Math.round(size * 0.18)} className={cn("shrink-0", className)} style={{ width: size }} />;
}

export function IconBubble({ icon: Icon, color = "#8cc63e", size = 38 }: { icon: LucideIcon; color?: string; size?: number }) {
  return <span className="icon-gloss grid shrink-0 place-items-center rounded-full text-white" style={{ width: size, height: size, background: `linear-gradient(180deg, ${color}, ${shade(color)})` }}><Icon size={size * 0.48} strokeWidth={2.3} className="relative z-[1]" /></span>;
}
function shade(hex: string) { const n = parseInt(hex.slice(1), 16); return `rgb(${((n >> 16) & 255) * 0.62 | 0},${((n >> 8) & 255) * 0.62 | 0},${(n & 255) * 0.62 | 0})`; }

export function RePortLogo({ size = 28, className }: { size?: number; color?: string; className?: string }) {
  return (
    <img
      src="/icon.png"
      alt="Re:Port app icon"
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ width: size, height: size, borderRadius: "20%", display: "block" }}
    />
  );
}

export const AVATAR_PRESETS: { id: AvatarPreset; label: string }[] = [
  { id: "gamepad", label: "Gamepad" },
  { id: "initials", label: "Initials" },
  { id: "nxe", label: "NXE Buddy" },
  { id: "dandelion", label: "Dandelion" },
  { id: "sword", label: "Blade" },
  { id: "crown", label: "Crown" },
  { id: "ghost", label: "Ghost" },
  { id: "flame", label: "Flame" },
  { id: "bolt", label: "Volt" },
  { id: "planet", label: "Orbit" },
  { id: "heart", label: "1-Up" },
  { id: "shield", label: "Crest" },
];

export function PresetGlyph({ preset, size, initials }: { preset: AvatarPreset; size: number; initials: string }) {
  const s = Math.round(size * 0.56);
  switch (preset) {
    case "initials":
      return <span style={{ fontSize: size * 0.36, fontWeight: 800, letterSpacing: "-0.02em" }} className="relative z-[1] select-none drop-shadow">{initials}</span>;
    case "nxe":
      return (
        <svg width={s} height={s * 1.15} viewBox="0 0 40 52" className="relative z-[1] drop-shadow" aria-hidden>
          <circle cx="20" cy="12" r="8.5" fill="#fff" />
          <path d="M8 46c0-11 5.5-18 12-18s12 7 12 18H8z" fill="#fff" />
        </svg>
      );
    case "gamepad":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M8 12h20a6 6 0 0 1 5.8 7.5l-1.6 6.5a3.5 3.5 0 0 1-6 1.5L23 24H13l-3.2 3.5a3.5 3.5 0 0 1-6-1.5L2.2 19.5A6 6 0 0 1 8 12z" fill="#fff" />
          <path d="M11 16v5M8.5 18.5h5" stroke="#1e293b" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="24" cy="17" r="1.6" fill="#1e293b" />
          <circle cx="27" cy="19.5" r="1.6" fill="#1e293b" />
        </svg>
      );
    case "dandelion":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <g stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="16" x2="18" y2="31" />
            <line x1="18" y1="16" x2="10" y2="8" /><line x1="18" y1="16" x2="26" y2="8" />
            <line x1="18" y1="16" x2="18" y2="6" /><line x1="18" y1="16" x2="8" y2="16" /><line x1="18" y1="16" x2="28" y2="16" />
            <line x1="18" y1="16" x2="11" y2="22" /><line x1="18" y1="16" x2="25" y2="22" />
          </g>
          <circle cx="18" cy="16" r="3" fill="#fff" />
          <circle cx="10" cy="8" r="1.8" fill="#fff" /><circle cx="26" cy="8" r="1.8" fill="#fff" />
          <circle cx="18" cy="6" r="1.8" fill="#fff" /><circle cx="8" cy="16" r="1.8" fill="#fff" /><circle cx="28" cy="16" r="1.8" fill="#fff" />
        </svg>
      );
    case "sword":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M26 6l4 4-13 13-4-4L26 6z" fill="#fff" />
          <path d="M11 17l8 8-2.5 2.5-8-8L11 17z" fill="#fff" opacity="0.85" />
          <path d="M9 23l4 4-4 3-3-3 3-4z" fill="#fff" />
        </svg>
      );
    case "crown":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M5 26L7 12l6.5 6L18 9l4.5 9L29 12l2 14H5z" fill="#fff" />
          <rect x="6" y="27.5" width="24" height="3" rx="1.5" fill="#fff" />
        </svg>
      );
    case "ghost":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M8 18a10 10 0 0 1 20 0v11l-3.3-2.5L21.3 29 18 26.5 14.7 29l-3.4-2.5L8 29V18z" fill="#fff" />
          <circle cx="14.5" cy="17" r="2" fill="#1e293b" />
          <circle cx="21.5" cy="17" r="2" fill="#1e293b" />
        </svg>
      );
    case "flame":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M19 5c2 6-3 8-2 13 2-1 4-4 4-6 4 4 6 9 3 14a9 9 0 0 1-14-9c0-5 5-8 9-12z" fill="#fff" />
        </svg>
      );
    case "bolt":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M20 4L8 20h8l-2 12 14-17h-8l0-11z" fill="#fff" />
        </svg>
      );
    case "planet":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <circle cx="18" cy="18" r="7.5" fill="#fff" />
          <ellipse cx="18" cy="18" rx="14" ry="4.2" transform="rotate(-22 18 18)" stroke="#fff" strokeWidth="2.3" fill="none" />
        </svg>
      );
    case "heart":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M18 29s-11-6.7-11-14.5a6.2 6.2 0 0 1 11-3.8 6.2 6.2 0 0 1 11 3.8C29 22.3 18 29 18 29z" fill="#fff" />
        </svg>
      );
    case "shield":
      return (
        <svg width={s} height={s} viewBox="0 0 36 36" className="relative z-[1] drop-shadow" aria-hidden>
          <path d="M18 5l11 4v9c0 7.5-4.7 11.8-11 14-6.3-2.2-11-6.5-11-14V9l11-4z" fill="#fff" />
          <path d="M18 9v19" stroke="#1e293b" strokeWidth="2" opacity="0.4" />
          <path d="M11 15h14" stroke="#1e293b" strokeWidth="2" opacity="0.4" />
        </svg>
      );
  }
}

export function InitialAvatar({
  name,
  size = 40,
  className,
  configOverride,
}: {
  name: string;
  size?: number;
  className?: string;
  configOverride?: AvatarConfig;
}) {
  const { avatar: ctxAvatar } = useApp();
  const cfg = configOverride ?? ctxAvatar;
  const initials = name.trim().slice(0, 2).toUpperCase() || "RP";

  if (cfg.mode === "image" && cfg.imageUrl) {
    return (
      <span
        className={cn("icon-gloss relative inline-block shrink-0 overflow-hidden rounded-full bg-black/20", className)}
        style={{ width: size, height: size }}
      >
        <img
          src={cfg.imageUrl}
          alt={name || "Profile avatar"}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn("icon-gloss grid shrink-0 place-items-center overflow-hidden rounded-full text-white", className)}
      style={{
        width: size,
        height: size,
        background: "linear-gradient(180deg, #c9ee6a, #5f9f22)",
      }}
    >
      <PresetGlyph preset={cfg.preset} size={size} initials={initials} />
    </span>
  );
}

/** Reads an uploaded File, center-crops it to a 256×256 square, and returns a compact Data URL. */
export function processImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format"));
      img.onload = () => {
        const target = 256;
        const canvas = document.createElement("canvas");
        canvas.width = target;
        canvas.height = target;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);
        try {
          resolve(canvas.toDataURL("image/webp", 0.86));
        } catch {
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function SettingRow({ icon, color, title, subtitle, right, onClick, chevron, last }: {
  icon: LucideIcon; color: string; title: string; subtitle?: string; right?: ReactNode; onClick?: () => void; chevron?: boolean; last?: boolean;
}) {
  return <div onClick={onClick} className={cn("relative z-[2] flex min-h-[56px] items-center gap-3 px-3.5 py-3", onClick && "press cursor-pointer", !last && "border-b border-black/[0.06]")}>
    <IconBubble icon={icon} color={color} />
    <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-semibold text-ink">{title}</div>{subtitle && <div className="truncate text-[11.5px] text-ink-soft">{subtitle}</div>}</div>
    {right}{chevron && <ChevronRight size={18} className="text-ink-soft/70" />}
  </div>;
}

export function EmptyState({ title, subtitle, icon: Icon, children }: { title: string; subtitle: string; icon?: LucideIcon; children?: ReactNode }) {
  return <div className="anim-rise flex flex-col items-center px-6 py-12 text-center">
    <span className="icon-gloss grid h-20 w-20 place-items-center rounded-full" style={{ background: "linear-gradient(180deg,#fff,#e8f3d5)" }}>
      {Icon ? <Icon size={32} className="text-lime-deep" /> : <RePortLogo size={44} color="#5f9f22" />}
    </span>
    <div className="t-white-shadow mt-4 text-[17px] font-semibold text-ink">{title}</div>
    <div className="mt-1 max-w-[290px] text-[12.5px] text-ink-soft">{subtitle}</div>
    {children && <div className="mt-4">{children}</div>}
  </div>;
}

export type BoolKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];
export function SettingToggle({ k, icon, color, title, subtitle, last }: { k: BoolKey; icon: LucideIcon; color: string; title: string; subtitle?: string; last?: boolean }) {
  const { settings, setSetting } = useApp();
  return <SettingRow icon={icon} color={color} title={title} subtitle={subtitle} last={last} right={<Toggle checked={settings[k]} onChange={(v) => setSetting(k, v)} />} />;
}

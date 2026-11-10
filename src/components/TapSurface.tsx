import { useRef, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/utils/cn";

/** A click surface that never fires during a scroll gesture.
 *  A tap is only accepted when the pointer stays within 10px of its start,
 *  is released within 600ms, and is not cancelled by the scroller. */
export function TapSurface({
  onTap, children, className, style, ariaLabel,
}: {
  onTap: () => void;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };
  const up = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = Math.abs(e.clientX - s.x);
    const dy = Math.abs(e.clientY - s.y);
    if (dx <= 10 && dy <= 10 && performance.now() - s.t <= 600) onTap();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn("tap-surface press", className)}
      style={style}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => { start.current = null; }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } }}
    >
      {children}
    </div>
  );
}

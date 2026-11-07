import { useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icons';
import { DataSaverContext } from './Cover';
import { Link, goBack } from '../lib/router';
import { skySrc, proxied } from '../lib/images';
import { STATUS_META } from '../lib/catalog';
import { useToast } from '../lib/ui';
import type { Status } from '../lib/types';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------ logo */
export function Logo({ size = 40 }: { size?: number }) {
  return <img src="./icon.svg" width={size} height={size} alt="" aria-hidden="true" className="rounded-full shadow-[0_3px_10px_rgba(0,20,40,.45)]" />;
}

/* ------------------------------------------------------------ hero */
export function HeroWaves() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 62C90 20 170 96 400 30V100H0Z" fill="rgba(255,255,255,.12)" />
      <path d="M0 76C120 42 200 100 400 54V100H0Z" fill="rgba(255,255,255,.16)" />
      <path d="M0 52C110 10 220 92 400 16" fill="none" stroke="var(--hero-line)" strokeWidth="2.4" />
      <path d="M0 60C110 18 220 100 400 24" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.4" />
    </svg>
  );
}

const BOKEH: [string, string, number, string][] = [
  ['6%', '34%', 74, '-3s'],
  ['72%', '10%', 54, '-8s'],
  ['86%', '58%', 96, '-5s'],
  ['40%', '70%', 38, '-11s'],
  ['24%', '8%', 28, '-1s'],
];

export function Hero({
  title,
  kicker = 'Re:Port',
  left,
  right,
  children,
}: {
  title: string;
  kicker?: string;
  left?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
}) {
  const saver = useContext(DataSaverContext);
  return (
    <header className="hero">
      {!saver && <div className="hero-sky" style={{ backgroundImage: `url("${skySrc()}")` }} aria-hidden="true" />}
      <div className="hero-shade" aria-hidden="true" />
      <div className="bokeh pointer-events-none absolute inset-0" aria-hidden="true">
        {BOKEH.map(([l, t, s, d], i) => (
          <i key={i} style={{ left: l, top: t, width: s, height: s, animationDelay: d }} />
        ))}
      </div>
      <HeroWaves />
      <div className="wrap relative">
        <div className="flex min-h-[46px] items-center justify-between gap-3">
          <div className="flex items-center gap-2">{left}</div>
          <div className="flex items-center gap-2">{right}</div>
        </div>
        <div className="mb-3 mt-4">
          <p className="hero-kicker">{kicker}</p>
          <div className="flex items-end">
            <h1 id="page-title" tabIndex={-1} className="hero-title min-w-0 outline-none">
              {title}
            </h1>
          </div>
        </div>
        {children}
        {!children && <div className="h-9" aria-hidden="true" />}
      </div>
      <div className="hero-fade" />
    </header>
  );
}

export function BackButton({ fallback = '/', label = 'Go back' }: { fallback?: string; label?: string }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={() => goBack(fallback)}>
      <Icon name="back" />
    </button>
  );
}

export function SectionHeader({ title, to, params, actionLabel = 'See all', id }: { title: string; to?: string; params?: Record<string, string>; actionLabel?: string; id?: string }) {
  return (
    <div className="wrap flex items-end justify-between gap-3">
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {to && (
        <Link to={to} params={params} className="flex min-h-[44px] items-center gap-0.5 pl-2 text-sm font-bold text-[var(--link)]">
          {actionLabel}
          <Icon name="chevron" size={18} />
        </Link>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- badges */
const STATUS_ICON: Record<Status, IconName> = { working: 'checkCircle', bugs: 'warn', untested: 'help', broken: 'block' };

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn('badge', `badge-${status}`)} title={STATUS_META[status].hint}>
      <Icon name={STATUS_ICON[status]} size={14} />
      {STATUS_META[status].label}
    </span>
  );
}

export function Pill({ icon, children, className }: { icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cn('badge badge-plain', className)}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------- empty */
export function EmptyState({ title, text, children, icon = 'search' }: { title: string; text: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className="panel mx-auto my-6 flex max-w-md flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-[var(--surface-2)] text-ink2">
        <Icon name={icon} size={30} />
      </span>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-ink2">{text}</p>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- switch */
export function Switch({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={id} className="font-semibold">
          {label}
        </p>
        {hint && <p className="mt-0.5 text-sm text-ink2">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-labelledby={id} className="switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

/* ----------------------------------------------------------- sheet */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      } else if (e.key === 'Tab' && el) {
        const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((x) => x.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <>
      <div className="backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="sheet outline-none">
        <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-[var(--line)]" aria-hidden="true" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-2)]">
            <Icon name="close" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </>
  );
}

/* ----------------------------------------------------- image viewer */
export function ImageViewer({ images, index, title, onClose }: { images: string[]; index: number; title: string; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = (i: number, smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    const n = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: smooth && document.documentElement.dataset.motion !== 'reduce' ? 'smooth' : 'auto' });
  };
  const current = () => {
    const el = scroller.current;
    return el ? Math.round(el.scrollLeft / el.clientWidth) : 0;
  };

  useEffect(() => {
    go(index, false);
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(current() + 1);
      if (e.key === 'ArrowLeft') go(current() - 1);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${title} screenshots`} className="fixed inset-0 z-[70] flex flex-col bg-black/95 text-white">
      <div className="flex items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)]">
        <p className="text-sm font-semibold" aria-live="polite">
          {title}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close viewer" className="grid h-11 w-11 place-items-center rounded-full bg-white/15">
          <Icon name="close" />
        </button>
      </div>
      <div ref={scroller} className="no-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {images.map((src, i) => (
          <div key={src} className="grid w-full flex-none snap-center place-items-center px-2">
            <img src={proxied(src, 1280, 80)} alt={`${title} screenshot ${i + 1} of ${images.length}`} crossOrigin="anonymous" decoding="async" className="max-h-[78dvh] max-w-full rounded-lg object-contain" />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-2">
        <button type="button" onClick={() => go(current() - 1)} aria-label="Previous screenshot" className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
          <Icon name="chevronLeft" />
        </button>
        <span className="text-sm text-white/80">{images.length} screenshots</span>
        <button type="button" onClick={() => go(current() + 1)} aria-label="Next screenshot" className="grid h-12 w-12 place-items-center rounded-full bg-white/15">
          <Icon name="chevron" />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- toast */
export function Toaster() {
  const { message, id } = useToast();
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div key={id} className="toast">
          {message}
        </div>
      )}
    </div>
  );
}

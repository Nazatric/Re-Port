import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { clampSlide, coverPose, dragTarget, nearestSlide } from '../lib/coverFlow';

interface Drag {
  id: number;
  type: string;
  x: number;
  y: number;
  scroll: number;
  startIndex: number;
  lastX: number;
  axis: 'pending' | 'x' | 'y';
  moved: boolean;
}

interface Controls {
  go: (index: number) => void;
  step: (delta: number) => void;
  blocksClick: () => boolean;
}

/** Native touch scrolling owns inertia and snapping. JS only paints depth and adds mouse dragging. */
export function useCoverFlow(count: number) {
  const viewport = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls>({ go: () => {}, step: () => {}, blocksClick: () => false });
  const selectedRef = useRef(0);
  const [selected, setSelected] = useState(0);
  const [settled, setSettled] = useState(0);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const slides = Array.from(el.querySelectorAll<HTMLElement>('.coverflow-slide'));
    const covers = slides.map((slide) => slide.querySelector<HTMLElement>('.coverflow-cover')!);
    let positions: number[] = [];
    let step = 1;
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    let requested: number | null = null;
    let drag: Drag | null = null;
    let blockClickUntil = 0;
    let width = 0;
    let coverWidth = 0;
    let reduced = document.documentElement.dataset.motion === 'reduce';

    const paint = () => {
      if (width <= 0) return;
      const x = el.scrollLeft;
      for (let i = 0; i < covers.length; i++) {
        const pose = coverPose((positions[i] - x) / step, reduced);
        covers[i].style.transform = pose.transform;
        covers[i].style.opacity = String(pose.opacity);
      }
      const next = nearestSlide(x, positions);
      if (next !== selectedRef.current) {
        selectedRef.current = next;
        setSelected(next);
      }
    };

    const schedulePaint = () => {
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    };

    const finish = () => {
      if (drag) return;
      clearTimeout(settleTimer);
      // WebKit can deliver an old scrollend while a resize or a newer button request is pending.
      // Only commit that request once it actually reaches its measured snap point.
      if (requested !== null && Math.abs(el.scrollLeft - (positions[requested] || 0)) > 1.5) {
        const target = requested;
        settleTimer = setTimeout(() => go(target, false), 100);
        return;
      }
      paint();
      requested = null;
      setSettled(selectedRef.current);
      el.dataset.scrolling = 'false';
    };

    const go = (index: number, animate = true) => {
      const target = clampSlide(index, count);
      requested = target;
      el.dataset.scrolling = 'true';
      el.scrollTo({ left: positions[target] || 0, behavior: animate && !reduced ? 'smooth' : 'auto' });
      schedulePaint();
      clearTimeout(settleTimer);
      settleTimer = setTimeout(finish, 180);
    };

    const measure = () => {
      const nextWidth = el.clientWidth;
      const nextCoverWidth = slides[0]?.offsetWidth || 0;
      if (nextWidth <= 0 || nextCoverWidth <= 0) {
        width = 0;
        coverWidth = 0;
        return;
      }
      if (positions.length && width === nextWidth && coverWidth === nextCoverWidth) return;
      width = nextWidth;
      coverWidth = nextCoverWidth;
      const max = Math.max(0, el.scrollWidth - width);
      positions = slides.map((slide) => Math.min(max, Math.max(0, slide.offsetLeft + slide.offsetWidth / 2 - width / 2)));
      step = positions.length > 1 ? positions[1] - positions[0] || 1 : coverWidth || 1;
      const preserve = clampSlide(requested ?? selectedRef.current, count);
      el.scrollTo({ left: positions[preserve] || 0, behavior: 'auto' });
      paint();
      setSettled(preserve);
    };

    const onScroll = () => {
      el.dataset.scrolling = 'true';
      schedulePaint();
      clearTimeout(settleTimer);
      // scrollend is not available in every Android WebView; keep an idle fallback.
      settleTimer = setTimeout(finish, 160);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      requested = null;
      clearTimeout(settleTimer);
      blockClickUntil = 0;
      drag = {
        id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY,
        scroll: el.scrollLeft, startIndex: selectedRef.current, lastX: e.clientX,
        axis: 'pending', moved: false,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.lastX = e.clientX;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.axis === 'pending' && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (drag.type !== 'mouse' || drag.axis !== 'x') return;
      if (!el.hasPointerCapture(e.pointerId)) el.setPointerCapture(e.pointerId);
      el.dataset.dragging = 'true';
      el.style.scrollSnapType = 'none';
      e.preventDefault();
      el.scrollLeft = drag.scroll - dx;
      schedulePaint();
    };

    const release = (cancelled: boolean) => {
      if (!drag) return;
      const previous = drag;
      drag = null;
      if (previous.moved || cancelled) blockClickUntil = performance.now() + 400;
      if (el.hasPointerCapture(previous.id)) el.releasePointerCapture(previous.id);
      delete el.dataset.dragging;
      el.style.removeProperty('scroll-snap-type');
      if (previous.type === 'mouse' && previous.axis === 'x') {
        const target = cancelled
          ? nearestSlide(el.scrollLeft, positions)
          : dragTarget(previous.startIndex, previous.lastX - previous.x, el.scrollLeft, positions);
        go(target);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) release(false);
    };
    const onPointerCancel = (e: PointerEvent) => {
      if (drag?.id === e.pointerId) release(true);
    };
    const onLostCapture = () => release(true);
    const onBlur = () => release(true);
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > 0) requested = null;
    };
    const preventImageDrag = (e: DragEvent) => e.preventDefault();

    controls.current = {
      go,
      step: (delta) => go((requested ?? selectedRef.current) + delta),
      blocksClick: () => performance.now() < blockClickUntil,
    };

    measure();
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', finish);
    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerCancel, { passive: true });
    el.addEventListener('lostpointercapture', onLostCapture);
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('dragstart', preventImageDrag);
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('blur', onBlur);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (slides[0]) observer.observe(slides[0]);
    const motion = new MutationObserver(() => {
      reduced = document.documentElement.dataset.motion === 'reduce';
      if (reduced && requested !== null) go(requested, false);
      schedulePaint();
    });
    motion.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });

    return () => {
      observer.disconnect();
      motion.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', finish);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
      el.removeEventListener('lostpointercapture', onLostCapture);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('dragstart', preventImageDrag);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [count]);

  const go = useCallback((index: number) => controls.current.go(index), []);
  const step = useCallback((delta: number) => controls.current.step(delta), []);
  const blocksClick = useCallback(() => controls.current.blocksClick(), []);
  return { viewport, selected, settled, go, step, blocksClick };
}
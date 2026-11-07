export function clampSlide(index: number, count: number): number {
  if (count < 1 || !Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}

export function nearestSlide(scrollLeft: number, positions: readonly number[]): number {
  let selected = 0;
  let distance = Infinity;
  for (let i = 0; i < positions.length; i++) {
    const next = Math.abs(scrollLeft - positions[i]);
    if (next < distance) {
      selected = i;
      distance = next;
    }
  }
  return selected;
}

/** Transform the artwork only. The layout/snap target always stays flat and measurable. */
export function coverPose(distance: number, reducedMotion: boolean) {
  const bounded = Math.max(-1, Math.min(1, distance));
  const amount = Math.abs(bounded);
  return {
    transform: reducedMotion
      ? 'none'
      : `translate3d(0, ${6 * amount}px, ${-24 * amount}px) rotateY(${-32 * bounded}deg) scale(${1 - 0.14 * amount})`,
    opacity: 1 - 0.22 * amount,
  };
}

export function dragTarget(start: number, distance: number, current: number, positions: readonly number[]): number {
  const closest = nearestSlide(current, positions);
  // A deliberate mouse drag can advance one cover without needing half its width.
  if (closest === start && Math.abs(distance) >= 36) {
    return clampSlide(start + (distance < 0 ? 1 : -1), positions.length);
  }
  return closest;
}
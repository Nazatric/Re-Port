import { describe, expect, it } from 'vitest';
import { clampSlide, coverPose, dragTarget, nearestSlide } from './coverFlow';

describe('cover-flow boundaries', () => {
  it('clamps both ends instead of wrapping or duplicating covers', () => {
    expect(clampSlide(-10, 12)).toBe(0);
    expect(clampSlide(100, 12)).toBe(11);
    expect(clampSlide(5, 12)).toBe(5);
  });
  it('handles empty, single-item and invalid requests', () => {
    expect(clampSlide(7, 0)).toBe(0);
    expect(clampSlide(7, 1)).toBe(0);
    expect(clampSlide(NaN, 12)).toBe(0);
    expect(clampSlide(Infinity, 12)).toBe(0);
  });
  it('finds the nearest measured snap point, including fractional widths', () => {
    const points = [0, 218.8, 437.6, 656.4];
    expect(nearestSlide(221, points)).toBe(1);
    expect(nearestSlide(440.2, points)).toBe(2);
    expect(nearestSlide(655.9, points)).toBe(3);
  });
  it('tolerates overscroll and empty lists', () => {
    expect(nearestSlide(-200, [0, 200, 400])).toBe(0);
    expect(nearestSlide(900, [0, 200, 400])).toBe(2);
    expect(nearestSlide(10, [])).toBe(0);
  });
  it('uses a stable tie-break at a snap midpoint', () => {
    expect(nearestSlide(100, [0, 200, 400])).toBe(0);
  });
});

describe('cover-flow appearance', () => {
  it('keeps the selected cover full size and face-on', () => {
    expect(coverPose(0, false)).toEqual({ transform: 'translate3d(0, 0px, 0px) rotateY(0deg) scale(1)', opacity: 1 });
  });
  it('mirrors the neighboring cover angles', () => {
    expect(coverPose(-1, false).transform).toContain('rotateY(32deg)');
    expect(coverPose(1, false).transform).toContain('rotateY(-32deg)');
    expect(coverPose(-1, false).opacity).toBe(coverPose(1, false).opacity);
  });
  it('bounds transforms, so offscreen covers cannot grow or invert', () => {
    expect(coverPose(100, false)).toEqual(coverPose(1, false));
    expect(coverPose(-100, false)).toEqual(coverPose(-1, false));
    for (let d = -4; d <= 4; d += 0.1) {
      expect(coverPose(d, false).opacity).toBeGreaterThanOrEqual(0.78);
      expect(coverPose(d, false).opacity).toBeLessThanOrEqual(1);
    }
  });
  it('removes all 3D movement for reduced motion', () => {
    for (const d of [-10, -1, 0, 0.5, 1, 10]) expect(coverPose(d, true).transform).toBe('none');
  });
});

describe('mouse drag intent', () => {
  const points = [0, 200, 400, 600];
  it('ignores tiny accidental movement', () => {
    expect(dragTarget(1, -7, 207, points)).toBe(1);
  });
  it('advances once for a deliberate short drag in either direction', () => {
    expect(dragTarget(1, -60, 260, points)).toBe(2);
    expect(dragTarget(1, 60, 140, points)).toBe(0);
  });
  it('snaps longer drags to the nearest cover rather than one step', () => {
    expect(dragTarget(0, -480, 480, points)).toBe(2);
  });
  it('never escapes the first or last cover', () => {
    expect(dragTarget(0, 100, 0, points)).toBe(0);
    expect(dragTarget(3, -100, 600, points)).toBe(3);
    expect(dragTarget(0, -50, 0, [0])).toBe(0);
  });
});
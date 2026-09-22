import type { Degree } from '../types';

export const degToRad = (deg: Degree): number => (deg * Math.PI) / 180;
export const radToDeg = (rad: number): Degree => (rad * 180) / Math.PI;

/** [0, 360) に正規化する。370 -> 10、-10 -> 350。 */
export function normalizeDeg(deg: Degree): Degree {
  const r = deg % 360;
  const n = r < 0 ? r + 360 : r;
  return n === 360 || Object.is(n, -0) ? 0 : n;
}

/** step 度刻みに丸めて正規化する。step <= 0 なら正規化のみ。 */
export function snapAngle(deg: Degree, step: number): Degree {
  if (step <= 0) return normalizeDeg(deg);
  return normalizeDeg(Math.round(deg / step) * step);
}

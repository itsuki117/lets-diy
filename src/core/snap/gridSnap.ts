import type { Vec3 } from '../types';

/** step 刻みに丸める。step <= 0 ならそのまま返す。 */
export function snapValue(v: number, step: number): number {
  if (step <= 0) return v;
  return Math.round(v / step) * step + 0;
}

export const snapVec3 = (v: Vec3, step: number): Vec3 => [
  snapValue(v[0], step),
  snapValue(v[1], step),
  snapValue(v[2], step),
];

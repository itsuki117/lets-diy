import type { Vec3 } from '../types';

export const vec = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const negate = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export function normalize(a: Vec3): Vec3 {
  const len = length(a);
  return len < 1e-12 ? [0, 0, 0] : [a[0] / len, a[1] / len, a[2] / len];
}

export const equals = (a: Vec3, b: Vec3, eps = 1e-6): boolean =>
  Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps && Math.abs(a[2] - b[2]) <= eps;

/** 成分ごとに丸める。-0 は 0 に寄せる。 */
export const clean = (a: Vec3, digits = 6): Vec3 => {
  const f = 10 ** digits;
  return [Math.round(a[0] * f) / f + 0, Math.round(a[1] * f) / f + 0, Math.round(a[2] * f) / f + 0];
};

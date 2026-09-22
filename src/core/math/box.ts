import type { AxisDirection, Size3, Vec3 } from '../types';
import { dirToVec3 } from './axis';

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export const sizeToArray = (size: Size3): Vec3 => [size.x, size.y, size.z];
export const arrayToSize = (a: Vec3): Size3 => ({ x: a[0], y: a[1], z: a[2] });

/** 中心原点の直方体の 8 頂点（ローカル座標） */
export function localCorners(size: Size3): Vec3[] {
  const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2;
  const out: Vec3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) out.push([sx * hx, sy * hy, sz * hz]);
    }
  }
  return out;
}

export function aabbFromPoints(points: readonly Vec3[]): Aabb {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[2] < minZ) minZ = p[2];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
    if (p[2] > maxZ) maxZ = p[2];
  }
  return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
}

export const aabbCenter = (b: Aabb): Vec3 => [
  (b.min[0] + b.max[0]) / 2,
  (b.min[1] + b.max[1]) / 2,
  (b.min[2] + b.max[2]) / 2,
];

export const aabbSize = (b: Aabb): Vec3 => [
  b.max[0] - b.min[0],
  b.max[1] - b.min[1],
  b.max[2] - b.min[2],
];

export const unionAabb = (a: Aabb, b: Aabb): Aabb => ({
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
});

/** 面の中心（中心原点ローカル座標） */
export function localFaceCenter(size: Size3, dir: AxisDirection): Vec3 {
  const n = dirToVec3(dir);
  return [(n[0] * size.x) / 2, (n[1] * size.y) / 2, (n[2] * size.z) / 2];
}

import { aabbFromPoints, localCorners, type Aabb } from '../math/box';
import { localToWorldPoint } from '../math/matrix';
import type { Part, Vec3 } from '../types';

export const localAabb = (part: Part): Aabb => aabbFromPoints(localCorners(part.size));

export const worldCorners = (part: Part): Vec3[] =>
  localCorners(part.size).map((p) => localToWorldPoint(part.transform, p));

export const worldAabb = (part: Part): Aabb => aabbFromPoints(worldCorners(part));

export function partsAabb(parts: readonly Part[]): Aabb | null {
  if (parts.length === 0) return null;
  return aabbFromPoints(parts.flatMap((p) => worldCorners(p)));
}

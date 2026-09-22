import { createPart } from '../part/createPart';
import type { Part, Size3, Vec3 } from '../types';

export const PLANK: Size3 = { x: 600, y: 300, z: 18 };

export function makePart(overrides: { size?: Size3; position?: Vec3; rotation?: Vec3; name?: string } = {}): Part {
  return createPart({
    name: overrides.name ?? 'テスト板',
    size: overrides.size ?? PLANK,
    position: overrides.position ?? [0, 0, 0],
    rotation: overrides.rotation ?? [0, 0, 0],
  });
}

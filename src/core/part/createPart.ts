import { createPartId } from '../ids';
import { DEFAULT_PART_SIZE } from '../constants';
import type { MaterialKind, Part, Size3, Transform, Vec3 } from '../types';

export interface CreatePartInput {
  name?: string;
  size?: Size3;
  material?: MaterialKind;
  position?: Vec3;
  rotation?: Vec3;
}

export const IDENTITY_TRANSFORM: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] };

export function createPart(input: CreatePartInput = {}): Part {
  const size = input.size ?? DEFAULT_PART_SIZE;
  return {
    id: createPartId(),
    kind: 'wood',
    name: input.name?.trim() || '木材',
    size: { ...size },
    transform: {
      position: input.position ?? [0, size.y / 2, 0],
      rotation: input.rotation ?? [0, 0, 0],
    },
    material: input.material ?? 'plywood',
    operations: [],
    visible: true,
    locked: false,
    createdAt: new Date().toISOString(),
  };
}

/** 「木材 1」「木材 2」…のように、既存名と衝突しない連番名を作る */
export function nextPartName(existing: readonly string[], base = '木材'): string {
  const used = new Set(existing);
  for (let i = 1; i < 10000; i += 1) {
    const candidate = `${base} ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return base;
}

/** 「側板 A (コピー)」「側板 A (コピー 2)」…のように衝突しないコピー名を作る */
export function copyName(name: string, existing: readonly string[]): string {
  const used = new Set(existing);
  const first = `${name} (コピー)`;
  if (!used.has(first)) return first;
  for (let i = 2; i < 10000; i += 1) {
    const candidate = `${name} (コピー ${i})`;
    if (!used.has(candidate)) return candidate;
  }
  return first;
}

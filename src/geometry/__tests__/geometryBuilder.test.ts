import { describe, expect, it } from 'vitest';
import { buildPartGeometry } from '../geometryBuilder';
import { createBoxGeometry } from '../boxGeometry';
import { createPart } from '../../core/part/createPart';
import { createOperationId } from '../../core/ids';
import type { Operation, Part } from '../../core/types';

const PLANK = { x: 600, y: 300, z: 18 };
const base = (): Part => createPart({ size: PLANK, position: [0, 0, 0] });

const roundHole = (over: Partial<Extract<Operation, { type: 'roundHole' }>> = {}): Operation =>
  ({
    id: createOperationId(),
    type: 'roundHole',
    enabled: true,
    diameter: 8,
    depth: 9,
    through: true,
    position: [0, 0, 0],
    direction: '-z',
    ...over,
  }) as Operation;

const count = (part: Part) => buildPartGeometry(part).then((r) => r.geometry.getAttribute('position').count);

describe('buildPartGeometry', () => {
  it('加工 0 件なら素のボックスと同じ頂点数', async () => {
    const plain = createBoxGeometry(PLANK).getAttribute('position').count;
    expect(await count(base())).toBe(plain);
  });

  it('貫通丸穴を開けると頂点が増える', async () => {
    const plain = await count(base());
    expect(await count({ ...base(), operations: [roundHole()] })).toBeGreaterThan(plain);
  });

  it('enabled: false の加工は無視される', async () => {
    const plain = await count(base());
    expect(await count({ ...base(), operations: [roundHole({ enabled: false })] })).toBe(plain);
  });

  it('切断すると境界が縮む', async () => {
    const cut: Operation = { id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 0, keep: 'negative' };
    const result = await buildPartGeometry({ ...base(), operations: [cut] });
    result.geometry.computeBoundingBox();
    expect(result.geometry.boundingBox!.max.x).toBeCloseTo(0, 3);
    expect(result.geometry.boundingBox!.min.x).toBeCloseTo(-300, 3);
  });

  it('形状が消滅する加工は失敗として記録し、直前の形状を保つ', async () => {
    const killer: Operation = {
      id: createOperationId(),
      type: 'notch',
      enabled: true,
      size: { x: 5000, y: 5000, z: 5000 },
      position: [0, 0, 0],
    };
    const result = await buildPartGeometry({ ...base(), operations: [killer] });
    expect(result.failedOperationIds).toContain(killer.id);
    expect(result.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it('加工を 5 件重ねても破綻しない', async () => {
    const ops = [-200, -100, 0, 100, 200].map((x) => roundHole({ position: [x, 0, 0] }));
    const result = await buildPartGeometry({ ...base(), operations: ops });
    expect(result.failedOperationIds).toHaveLength(0);
    expect(result.geometry.getAttribute('position').count).toBeGreaterThan(24);
  });

  it('同じ 2 加工は順序を変えても同じ外接箱になる', async () => {
    const a = roundHole({ position: [-200, 0, 0] });
    const b: Operation = { id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 100, keep: 'negative' };
    const first = await buildPartGeometry({ ...base(), operations: [a, b] });
    const second = await buildPartGeometry({ ...base(), operations: [b, a] });
    first.geometry.computeBoundingBox();
    second.geometry.computeBoundingBox();
    expect(first.geometry.boundingBox!.max.x).toBeCloseTo(second.geometry.boundingBox!.max.x, 3);
    expect(first.geometry.boundingBox!.min.x).toBeCloseTo(second.geometry.boundingBox!.min.x, 3);
  });
});

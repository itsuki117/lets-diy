import { describe, expect, it } from 'vitest';
import { computeAlignedPositions } from '../snap/align';
import { worldAabb } from '../part/partBounds';
import type { AlignAnchor, AxisKey, Part } from '../types';
import { makePart } from './fixtures';

const applied = (parts: Part[], axis: AxisKey, anchor: AlignAnchor): Part[] => {
  const moves = computeAlignedPositions(parts, axis, anchor);
  return parts.map((p) => {
    const next = moves.get(p.id);
    return next ? { ...p, transform: { ...p.transform, position: next } } : p;
  });
};

describe('computeAlignedPositions', () => {
  const trio = (): Part[] => [
    makePart({ position: [0, 0, 0] }),
    makePart({ position: [500, 120, 40] }),
    makePart({ position: [-300, -60, 900] }),
  ];

  it.each(['x', 'y', 'z'] as AxisKey[])('%s 軸 min で端が揃う', (axis) => {
    const out = applied(trio(), axis, 'min');
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const mins = out.map((p) => worldAabb(p).min[index]);
    for (const m of mins) expect(m).toBeCloseTo(mins[0] as number, 6);
  });

  it.each(['x', 'y', 'z'] as AxisKey[])('%s 軸 max で端が揃う', (axis) => {
    const out = applied(trio(), axis, 'max');
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const maxs = out.map((p) => worldAabb(p).max[index]);
    for (const m of maxs) expect(m).toBeCloseTo(maxs[0] as number, 6);
  });

  it.each(['x', 'y', 'z'] as AxisKey[])('%s 軸 center で中心が揃う', (axis) => {
    const out = applied(trio(), axis, 'center');
    const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const centers = out.map((p) => {
      const box = worldAabb(p);
      return (box.min[index] + box.max[index]) / 2;
    });
    for (const c of centers) expect(c).toBeCloseTo(centers[0] as number, 6);
  });

  it('回転した部材も AABB 基準で揃う', () => {
    const parts = [makePart({ position: [0, 0, 0], rotation: [0, 45, 0] }), makePart({ position: [900, 0, 0] })];
    const out = applied(parts, 'x', 'min');
    expect(worldAabb(out[0] as Part).min[0]).toBeCloseTo(worldAabb(out[1] as Part).min[0], 6);
  });

  it('1 件だけなら何も動かない', () => {
    expect(computeAlignedPositions([makePart()], 'x', 'min').size).toBe(0);
  });

  it('指定軸以外は動かさない', () => {
    const parts = trio();
    const out = applied(parts, 'x', 'min');
    out.forEach((p, i) => {
      expect(p.transform.position[1]).toBeCloseTo((parts[i] as Part).transform.position[1], 9);
      expect(p.transform.position[2]).toBeCloseTo((parts[i] as Part).transform.position[2], 9);
    });
  });
});

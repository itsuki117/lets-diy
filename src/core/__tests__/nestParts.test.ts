import { describe, expect, it } from 'vitest';
import { nestParts } from '../nesting/nestParts';
import type { StockSheet } from '../nesting/stockSheets';
import { makePart } from './fixtures';

const stock: StockSheet = { id: 'test', label: 'test', width: 100, height: 100, thickness: 18 };

describe('nestParts', () => {
  it('places fitting pieces and reports usage', () => {
    const result = nestParts([makePart({ size: { x: 40, y: 30, z: 18 } })], [stock], 3);
    expect(result.sheets).toHaveLength(1);
    expect(result.unplaced).toEqual([]);
    expect(result.sheets[0]!.usage).toBeCloseTo(0.12);
  });

  it('uses kerf and starts a second sheet when needed', () => {
    const parts = [makePart({ size: { x: 50, y: 100, z: 18 }, name: 'A' }), makePart({ size: { x: 50, y: 100, z: 18 }, name: 'B' })];
    expect(nestParts(parts, [stock], 0).sheets).toHaveLength(1);
    expect(nestParts(parts, [stock], 3).sheets).toHaveLength(2);
  });

  it('rotates a piece or reports an oversize one', () => {
    const rotated = nestParts([makePart({ size: { x: 90, y: 110, z: 18 } })], [{ ...stock, width: 90, height: 110 }]);
    expect(rotated.sheets[0]!.pieces[0]!.rotated).toBe(true);
    const tooLarge = nestParts([makePart({ size: { x: 120, y: 110, z: 18 } })], [stock]);
    expect(tooLarge.unplaced).toHaveLength(1);
  });

  it('keeps different material or thickness groups on different sheets', () => {
    const a = makePart({ size: { x: 30, y: 30, z: 18 } });
    const b = { ...makePart({ size: { x: 30, y: 30, z: 18 } }), material: 'mdf' as const };
    const result = nestParts([a, b], [stock]);
    expect(result.sheets).toHaveLength(2);
  });
});

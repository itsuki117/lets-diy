import { describe, expect, it } from 'vitest';
import { createBoxGeometry } from '../boxGeometry';

describe('createBoxGeometry', () => {
  it('中心原点で、指定した寸法になる', () => {
    const g = createBoxGeometry({ x: 600, y: 300, z: 18 });
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.x).toBeCloseTo(-300);
    expect(box.max.x).toBeCloseTo(300);
    expect(box.min.y).toBeCloseTo(-150);
    expect(box.max.z).toBeCloseTo(9);
  });

  it('CSG に渡すため uv は落とす', () => {
    expect(createBoxGeometry({ x: 10, y: 10, z: 10 }).getAttribute('uv')).toBeUndefined();
  });

  it('頂点 24 / インデックス 36', () => {
    const g = createBoxGeometry({ x: 10, y: 10, z: 10 });
    expect(g.getAttribute('position').count).toBe(24);
    expect(g.getIndex()?.count).toBe(36);
  });
});

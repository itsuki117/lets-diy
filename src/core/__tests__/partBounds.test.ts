import { describe, expect, it } from 'vitest';
import { worldAabb } from '../part/partBounds';
import { makePart, PLANK } from './fixtures';

describe('worldAabb', () => {
  it('回転 0 なら size の半分ずつ', () => {
    const box = worldAabb(makePart());
    expect(box.min[0]).toBeCloseTo(-300);
    expect(box.max[0]).toBeCloseTo(300);
    expect(box.max[2]).toBeCloseTo(9);
  });

  it('Y 軸 90 度回転で X と Z が入れ替わる', () => {
    const box = worldAabb(makePart({ rotation: [0, 90, 0] }));
    expect(box.max[0] - box.min[0]).toBeCloseTo(PLANK.z, 4);
    expect(box.max[2] - box.min[2]).toBeCloseTo(PLANK.x, 4);
  });

  it('Z 軸 45 度回転すると X 方向の AABB は元より大きくなる', () => {
    // 600 と 300 が混ざるので 600*cos45 + 300*sin45 = 636mm
    const box = worldAabb(makePart({ rotation: [0, 0, 45] }));
    expect(box.max[0] - box.min[0]).toBeGreaterThan(PLANK.x);
    expect(box.max[0] - box.min[0]).toBeCloseTo((PLANK.x + PLANK.y) * Math.SQRT1_2, 4);
  });

  it('Y 軸 45 度回転では、薄い Z と混ざるので X 方向はむしろ縮む', () => {
    const box = worldAabb(makePart({ rotation: [0, 45, 0] }));
    expect(box.max[0] - box.min[0]).toBeCloseTo((PLANK.x + PLANK.z) * Math.SQRT1_2, 4);
  });

  it('位置がそのまま反映される', () => {
    const box = worldAabb(makePart({ position: [1000, 0, 0] }));
    expect(box.min[0]).toBeCloseTo(700);
    expect(box.max[0]).toBeCloseTo(1300);
  });
});

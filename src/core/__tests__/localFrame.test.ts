import { describe, expect, it } from 'vitest';
import { cornerToLocal, localToCorner } from '../part/localFrame';
import { localCorners } from '../math/box';
import { PLANK } from './fixtures';

describe('localFrame', () => {
  it('コーナー原点 (100, 50, 0) は中心原点 (-200, -100, -9)', () => {
    expect(cornerToLocal(PLANK, [100, 50, 0])).toEqual([-200, -100, -9]);
  });

  it('往復変換で元に戻る（8 頂点すべて）', () => {
    for (const corner of localCorners(PLANK).map((p) => localToCorner(PLANK, p))) {
      const back = localToCorner(PLANK, cornerToLocal(PLANK, corner));
      expect(back[0]).toBeCloseTo(corner[0], 9);
      expect(back[1]).toBeCloseTo(corner[1], 9);
      expect(back[2]).toBeCloseTo(corner[2], 9);
    }
  });

  it('中心はコーナー原点で size/2', () => {
    expect(localToCorner(PLANK, [0, 0, 0])).toEqual([300, 150, 9]);
  });
});

import { describe, expect, it } from 'vitest';
import { toolSolidSpec } from '../../core/operation/toolSolid';
import { createOperationId } from '../../core/ids';
import { createPart } from '../../core/part/createPart';
import { ALL_DIRECTIONS } from '../../core/math/axis';
import { ALL_CORNERS, type Operation, type RoundCornerOperation, type Size3 } from '../../core/types';
import { createToolGeometry } from '../toolGeometry';
import { buildPartGeometry } from '../geometryBuilder';
import { createBoxGeometry } from '../boxGeometry';

const PLANK: Size3 = { x: 600, y: 300, z: 18 };
const base = () => createPart({ size: PLANK, position: [0, 0, 0] });

const round = (over: Partial<RoundCornerOperation> = {}): RoundCornerOperation => ({
  id: createOperationId(),
  type: 'roundCorner',
  enabled: true,
  radius: 40,
  direction: '-z',
  corners: [...ALL_CORNERS],
  ...over,
});

/** ある点が最終形状の内側にあるか、頂点の分布から大まかに見る */
const hasVertexNear = (geo: ReturnType<typeof createBoxGeometry>, x: number, y: number, tol = 3): boolean => {
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    if (Math.abs(pos.getX(i) - x) < tol && Math.abs(pos.getY(i) - y) < tol) return true;
  }
  return false;
};

describe('createToolGeometry: 角丸の枠', () => {
  it('枠は素材より少し大きい外形を持つ', () => {
    const g = createToolGeometry(toolSolidSpec(round(), PLANK));
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.x - box.min.x).toBeGreaterThan(PLANK.x);
    expect(box.max.y - box.min.y).toBeGreaterThan(PLANK.y);
  });

  it('6 方向すべてで生成できる', () => {
    for (const direction of ALL_DIRECTIONS) {
      const g = createToolGeometry(toolSolidSpec(round({ direction }), PLANK));
      expect(g.getAttribute('position').count).toBeGreaterThan(0);
    }
  });
});

describe('buildPartGeometry: 角丸', () => {
  it('四隅を丸めると、元の角の頂点が消える', async () => {
    const plain = await buildPartGeometry(base());
    expect(hasVertexNear(plain.geometry, 300, 150)).toBe(true);

    const rounded = await buildPartGeometry({ ...base(), operations: [round({ radius: 40 })] });
    expect(rounded.failedOperationIds).toHaveLength(0);
    // 角そのものは削られて無くなる
    expect(hasVertexNear(rounded.geometry, 300, 150, 1)).toBe(false);
    // 外形の最大寸法は変わらない（辺の途中は残る）
    rounded.geometry.computeBoundingBox();
    expect(rounded.geometry.boundingBox!.max.x).toBeCloseTo(300, 2);
    expect(rounded.geometry.boundingBox!.max.y).toBeCloseTo(150, 2);
  });

  it('選んだ角だけが落ちる', async () => {
    const result = await buildPartGeometry({
      ...base(),
      operations: [round({ radius: 40, corners: ['topRight'] })],
    });
    expect(result.failedOperationIds).toHaveLength(0);
    // 右上は落ちる
    expect(hasVertexNear(result.geometry, 300, 150, 1)).toBe(false);
    // 左下は残る
    expect(hasVertexNear(result.geometry, -300, -150, 1)).toBe(true);
  });

  it('6 方向すべてで CSG が通る', async () => {
    for (const direction of ALL_DIRECTIONS) {
      const result = await buildPartGeometry({ ...base(), operations: [round({ direction, radius: 8 })] });
      expect(result.failedOperationIds).toHaveLength(0);
      expect(result.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  });

  it('角丸と丸穴・切断を重ねても破綻しない', async () => {
    const hole: Operation = {
      id: createOperationId(),
      type: 'roundHole',
      enabled: true,
      diameter: 8,
      depth: 9,
      through: true,
      position: [-200, 0, 0],
      direction: '-z',
    };
    const cut: Operation = { id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 100, keep: 'negative' };
    const result = await buildPartGeometry({ ...base(), operations: [round({ radius: 20 }), hole, cut] });
    expect(result.failedOperationIds).toHaveLength(0);
  });

  it('半径を変えると形状が変わる', async () => {
    const a = await buildPartGeometry({ ...base(), operations: [round({ radius: 10 })] });
    const b = await buildPartGeometry({ ...base(), operations: [round({ radius: 60 })] });
    expect(hasVertexNear(a.geometry, -300, -140, 2)).toBe(true);
    expect(hasVertexNear(b.geometry, -300, -140, 2)).toBe(false);
  });
});

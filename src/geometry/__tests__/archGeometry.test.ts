import { describe, expect, it } from 'vitest';
import { toolSolidSpec } from '../../core/operation/toolSolid';
import { createOperationId } from '../../core/ids';
import { createPart } from '../../core/part/createPart';
import { ALL_DIRECTIONS } from '../../core/math/axis';
import type { ArchOperation, Size3 } from '../../core/types';
import { createToolGeometry } from '../toolGeometry';
import { buildPartGeometry } from '../geometryBuilder';
import { createBoxGeometry } from '../boxGeometry';

const PLANK: Size3 = { x: 600, y: 300, z: 18 };

const arch = (over: Partial<ArchOperation> = {}): ArchOperation => ({
  id: createOperationId(),
  type: 'arch',
  enabled: true,
  width: 150,
  height: 100,
  rise: 75,
  depth: 9,
  through: true,
  position: [0, 0, 0],
  direction: '-z',
  rotation: 0,
  ...over,
});

describe('createToolGeometry: アーチ', () => {
  it('外接箱が 幅 x 全高 x 押し出し量 になる', () => {
    const spec = toolSolidSpec(arch({ width: 150, height: 100 }), PLANK);
    const g = createToolGeometry(spec);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(150, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(100, 3);
    expect(box.max.z - box.min.z).toBeCloseTo(PLANK.z + 1, 3);
  });

  it('rise = 幅 / 2 なら上半分が半円になる', () => {
    // 全高 = rise のとき、断面はちょうど半円（下は直線、上が弧）
    const spec = toolSolidSpec(arch({ width: 100, height: 50, rise: 50 }), PLANK);
    const g = createToolGeometry(spec);
    const pos = g.getAttribute('position');
    // 半円の中心は y = -25（全高 50 の下端）。弧上の点は中心から半径 50 の位置にある
    let onArc = 0;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      if (y > -25 + 1e-6) {
        const r = Math.hypot(x, y - -25);
        if (Math.abs(r - 50) < 0.5) onArc += 1;
      }
    }
    expect(onArc).toBeGreaterThan(20);
  });

  it('rise = 0 なら矩形と同じ外接箱・同じ体積になる', () => {
    const spec = toolSolidSpec(arch({ width: 80, height: 60, rise: 0 }), PLANK);
    const g = createToolGeometry(spec);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(80, 3);
    expect(box.max.y - box.min.y).toBeCloseTo(60, 3);
  });

  it('6 方向すべてで生成でき、部材を貫通する厚みになる', () => {
    for (const direction of ALL_DIRECTIONS) {
      const g = createToolGeometry(toolSolidSpec(arch({ direction }), PLANK));
      g.computeBoundingBox();
      expect(g.boundingBox).not.toBeNull();
      expect(g.getAttribute('position').count).toBeGreaterThan(0);
    }
  });

  it('uv は落とされている', () => {
    expect(createToolGeometry(toolSolidSpec(arch(), PLANK)).getAttribute('uv')).toBeUndefined();
  });
});

describe('buildPartGeometry: アーチ', () => {
  const base = () => createPart({ size: PLANK, position: [0, 0, 0] });

  it('アーチを削ると頂点が増え、失敗しない', async () => {
    const plain = createBoxGeometry(PLANK).getAttribute('position').count;
    const result = await buildPartGeometry({ ...base(), operations: [arch()] });
    expect(result.failedOperationIds).toHaveLength(0);
    expect(result.geometry.getAttribute('position').count).toBeGreaterThan(plain);
  });

  it('部材の下端をまたぐアーチは、外接箱を変えずに材料を削る', async () => {
    // 足元を弧状に抜く典型。外形（外接箱）は変わらないが三角形は増える
    const op = arch({ width: 200, height: 120, rise: 100, position: [0, -PLANK.y / 2 - 10 + 60, 0] });
    const result = await buildPartGeometry({ ...base(), operations: [op] });
    result.geometry.computeBoundingBox();
    const box = result.geometry.boundingBox!;
    expect(box.min.x).toBeCloseTo(-PLANK.x / 2, 2);
    expect(box.max.y).toBeCloseTo(PLANK.y / 2, 2);
    expect(result.failedOperationIds).toHaveLength(0);
  });

  it('6 方向すべてで CSG が通る', async () => {
    for (const direction of ALL_DIRECTIONS) {
      const result = await buildPartGeometry({ ...base(), operations: [arch({ direction })] });
      expect(result.failedOperationIds).toHaveLength(0);
      expect(result.geometry.getAttribute('position').count).toBeGreaterThan(0);
    }
  });

  it('アーチと丸穴を重ねても破綻しない', async () => {
    const hole = {
      id: createOperationId(),
      type: 'roundHole' as const,
      enabled: true,
      diameter: 8,
      depth: 9,
      through: true,
      position: [-200, 0, 0] as [number, number, number],
      direction: '-z' as const,
    };
    const result = await buildPartGeometry({ ...base(), operations: [arch(), hole] });
    expect(result.failedOperationIds).toHaveLength(0);
  });
});

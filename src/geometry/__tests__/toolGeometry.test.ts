import { describe, expect, it } from 'vitest';
import { toolSolidSpec } from '../../core/operation/toolSolid';
import { createToolGeometry } from '../toolGeometry';
import { createOperationId } from '../../core/ids';
import { ALL_DIRECTIONS, axisOf, axisSize } from '../../core/math/axis';
import type { Operation, Size3 } from '../../core/types';

const PLANK: Size3 = { x: 600, y: 300, z: 18 };

const hole = (over: Partial<Extract<Operation, { type: 'roundHole' }>> = {}) =>
  ({
    id: createOperationId(),
    type: 'roundHole',
    enabled: true,
    diameter: 8,
    depth: 10,
    through: true,
    position: [0, 0, 0],
    direction: '-z',
    ...over,
  }) as Operation;

describe('createToolGeometry', () => {
  it('spec の寸法と位置がジオメトリに焼き込まれる', () => {
    const spec = toolSolidSpec(
      { id: createOperationId(), type: 'notch', enabled: true, size: { x: 50, y: 40, z: 30 }, position: [10, 20, 30] },
      PLANK,
    );
    const g = createToolGeometry(spec);
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.min.x).toBeCloseTo(10 - 25, 4);
    expect(box.max.y).toBeCloseTo(20 + 20, 4);
    expect(box.max.z).toBeCloseTo(30 + 15, 4);
  });

  it('貫通穴の円柱は 6 方向すべてで板を突き抜ける', () => {
    for (const direction of ALL_DIRECTIONS) {
      const g = createToolGeometry(toolSolidSpec(hole({ direction }), PLANK));
      g.computeBoundingBox();
      const box = g.boundingBox!;
      const axis = axisOf(direction);
      const extent =
        axis === 'x' ? box.max.x - box.min.x : axis === 'y' ? box.max.y - box.min.y : box.max.z - box.min.z;
      expect(extent).toBeGreaterThan(axisSize(PLANK, axis));
    }
  });

  it('uv は落とされている', () => {
    expect(createToolGeometry(toolSolidSpec(hole(), PLANK)).getAttribute('uv')).toBeUndefined();
  });
});

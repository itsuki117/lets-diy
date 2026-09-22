import { describe, expect, it } from 'vitest';
import { createEdgesGeometry } from '../edgesGeometry';
import { createBoxGeometry } from '../boxGeometry';
import { buildPartGeometry } from '../geometryBuilder';
import { createPart } from '../../core/part/createPart';
import { createOperationId } from '../../core/ids';
import type { Operation } from '../../core/types';

const PLANK = { x: 600, y: 300, z: 18 };

describe('createEdgesGeometry', () => {
  it('素の直方体は 12 稜線ちょうど', () => {
    const edges = createEdgesGeometry(createBoxGeometry(PLANK));
    expect(edges.getAttribute('position').count / 2).toBe(12);
  });

  it('CSG 後も 12 稜線のまま（分割線を拾わない）', async () => {
    const notch: Operation = {
      id: createOperationId(),
      type: 'notch',
      enabled: true,
      size: { x: 75, y: 38, z: 30 },
      position: [262, 131, 0],
    };
    const part = createPart({ size: PLANK, position: [0, 0, 0] });
    const result = await buildPartGeometry({ ...part, operations: [notch] });
    const edges = createEdgesGeometry(result.geometry);
    expect(edges.getAttribute('position').count / 2).toBe(12);
  });

  it('切断すると枠も縮む', async () => {
    const cut: Operation = { id: createOperationId(), type: 'cut', enabled: true, axis: 'x', offset: 0, keep: 'negative' };
    const part = createPart({ size: PLANK, position: [0, 0, 0] });
    const result = await buildPartGeometry({ ...part, operations: [cut] });
    const edges = createEdgesGeometry(result.geometry);
    edges.computeBoundingBox();
    expect(edges.boundingBox!.max.x).toBeCloseTo(0, 3);
    expect(edges.boundingBox!.min.x).toBeCloseTo(-300, 3);
  });
});

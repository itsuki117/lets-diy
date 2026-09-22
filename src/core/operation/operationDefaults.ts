import { createOperationId } from '../ids';
import { OVERCUT } from '../constants';
import { axisSize, longestAxis, thinnestAxis } from '../math/axis';
import type { AxisDirection, Operation, OperationType, Part } from '../types';

/** 板材なら厚み方向の手前面から掘るのが自然 */
function defaultDirection(part: Part): AxisDirection {
  return `-${thinnestAxis(part.size)}` as AxisDirection;
}

export function defaultOperation(type: OperationType, part: Part): Operation {
  const id = createOperationId();
  const direction = defaultDirection(part);
  const depthAxis = thinnestAxis(part.size);
  const thickness = axisSize(part.size, depthAxis);

  switch (type) {
    case 'roundHole':
      return {
        id, type: 'roundHole', enabled: true,
        diameter: 8, depth: Math.max(1, Math.round(thickness / 2)), through: true,
        position: [0, 0, 0], direction,
      };
    case 'rectHole':
      return {
        id, type: 'rectHole', enabled: true,
        width: Math.max(10, Math.round(part.size.x / 10)),
        height: Math.max(10, Math.round(part.size.y / 10)),
        depth: Math.max(1, Math.round(thickness / 2)), through: true,
        position: [0, 0, 0], direction, rotation: 0,
      };
    case 'notch': {
      const w = Math.max(10, Math.round(part.size.x / 8));
      const h = Math.max(10, Math.round(part.size.y / 8));
      return {
        id, type: 'notch', enabled: true,
        size: { x: w, y: h, z: part.size.z + 2 * OVERCUT },
        position: [part.size.x / 2 - w / 2, part.size.y / 2 - h / 2, 0],
      };
    }
    case 'cut': {
      const axis = longestAxis(part.size);
      return { id, type: 'cut', enabled: true, axis, offset: 0, keep: 'negative' };
    }
  }
}

export const OPERATION_TYPE_LABELS: Record<OperationType, string> = {
  roundHole: '丸穴',
  rectHole: '角穴',
  notch: '切り欠き',
  cut: '切断',
};

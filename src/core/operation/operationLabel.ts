import { AXIS_LABELS, axisOf, axisValue, otherAxes } from '../math/axis';
import { localToCorner } from '../part/localFrame';
import { OPERATION_TYPE_LABELS } from './operationDefaults';
import type { AxisKey, Operation, Part, Vec3 } from '../types';

const num = (v: number): string => String(Math.round(v * 10) / 10);

/** 中心原点の値を、その軸のコーナー原点表示に直す */
const cornerOnAxis = (part: Part, axis: AxisKey, value: number): number =>
  axisValue(localToCorner(part.size, [value, value, value] as Vec3), axis);

/** 加工位置をコーナー原点で表示する。穴は面に沿った 2 軸だけ見せる。 */
function positionLabel(position: Vec3, part: Part, only?: [AxisKey, AxisKey]): string {
  const corner = localToCorner(part.size, position);
  if (!only) return `(${num(corner[0])}, ${num(corner[1])}, ${num(corner[2])})`;
  return `(${num(axisValue(corner, only[0]))}, ${num(axisValue(corner, only[1]))})`;
}

export function operationLabel(op: Operation, part: Part): string {
  const head = OPERATION_TYPE_LABELS[op.type];
  switch (op.type) {
    case 'roundHole': {
      const depth = op.through ? '貫通' : `深さ${num(op.depth)}`;
      return `${head} φ${num(op.diameter)} ${depth} @ ${positionLabel(op.position, part, otherAxes(axisOf(op.direction)))}`;
    }
    case 'rectHole': {
      const depth = op.through ? '貫通' : `深さ${num(op.depth)}`;
      return `${head} ${num(op.width)}x${num(op.height)} ${depth} @ ${positionLabel(op.position, part, otherAxes(axisOf(op.direction)))}`;
    }
    case 'notch':
      return `${head} ${num(op.size.x)}x${num(op.size.y)}x${num(op.size.z)} @ ${positionLabel(op.position, part)}`;
    case 'cut': {
      const axis = AXIS_LABELS[op.axis];
      const at = cornerOnAxis(part, op.axis, op.offset);
      const side = op.keep === 'negative' ? `${axis}-側を残す` : `${axis}+側を残す`;
      return `${head} ${axis}=${num(at)} / ${side}`;
    }
  }
}

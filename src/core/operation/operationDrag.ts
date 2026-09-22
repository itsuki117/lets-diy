import { axisOf, axisSize, axisValue, otherAxes, withAxis } from '../math/axis';
import { toolSolidSpec } from './toolSolid';
import type { AxisKey, Operation, Size3, Vec3 } from '../types';

/**
 * 加工位置をマウスで動かすための変換。
 *
 * 数値入力が主で、マウスは補助（設計書 §2.4）。ここは「3D 上のクリック」と
 * 「ギズモのドラッグ」の両方から呼ばれ、どちらも同じ結果になるようにしてある。
 */

/** ドラッグ用ハンドルを置く位置（部材ローカル、中心原点 mm） */
export function draftHandlePosition(op: Operation, size: Size3): Vec3 {
  switch (op.type) {
    // 角丸は素材の外形に対する加工なので、動かす位置を持たない
    case 'roundCorner':
      return [0, 0, 0];
    case 'cut':
      return withAxis([0, 0, 0], op.axis, op.offset);
    case 'notch':
      return op.position;
    default:
      // 穴とアーチは、実際に削られる場所（ツール立体の中心）にハンドルを置く
      return toolSolidSpec(op, size).position;
  }
}

/** 部材ローカルの各軸をギズモで動かせるか */
export function draggableAxes(op: Operation): Record<AxisKey, boolean> {
  switch (op.type) {
    case 'roundCorner':
      return { x: false, y: false, z: false };
    case 'cut':
      return { x: op.axis === 'x', y: op.axis === 'y', z: op.axis === 'z' };
    case 'notch':
      return { x: true, y: true, z: true };
    default: {
      // 掘る向きの軸は「どの面から掘るか」で決まるので動かさない
      const axis = axisOf(op.direction);
      return { x: axis !== 'x', y: axis !== 'y', z: axis !== 'z' };
    }
  }
}

/**
 * ドラッグ／クリック結果を Operation へ反映する。
 * 動かせない軸（穴の掘る向き、切断の面内 2 軸）の値は元のまま残す。
 */
export function applyDraftPosition(op: Operation, local: Vec3, size: Size3): Operation {
  switch (op.type) {
    case 'roundCorner':
      return op;
    case 'cut': {
      const half = axisSize(size, op.axis) / 2;
      const limit = Math.max(half - 0.5, 0);
      const offset = Math.min(Math.max(axisValue(local, op.axis), -limit), limit);
      return { ...op, offset };
    }
    case 'notch':
      return { ...op, position: local };
    default: {
      const [ua, va] = otherAxes(axisOf(op.direction));
      let position = op.position;
      position = withAxis(position, ua, axisValue(local, ua));
      position = withAxis(position, va, axisValue(local, va));
      return { ...op, position };
    }
  }
}

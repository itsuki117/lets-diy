import { OVERCUT } from '../constants';
import { axisOf, axisSize, otherAxes, signOf, withAxis, withAxisSize } from '../math/axis';
import type { AxisKey, Operation, Size3, ToolSolidSpec, Vec3 } from '../types';

/** 円柱の軸（+Y）を指定軸に向けるための Euler XYZ（度） */
function cylinderAlignRotation(axis: AxisKey): Vec3 {
  if (axis === 'y') return [0, 0, 0];
  if (axis === 'x') return [0, 0, 90];
  return [90, 0, 0];
}

/**
 * 穴の「入口側の面より OVERCUT だけ外」から掘り始めたときの、ツール立体の中心と深さ。
 * OVERCUT を入れないと CSG がコプラナー面を作り、穴が開かない・Z-fighting する。
 */
function holeAxisPlacement(
  axis: AxisKey,
  sign: 1 | -1,
  size: Size3,
  through: boolean,
  depth: number,
): { depth: number; center: number } {
  const half = axisSize(size, axis) / 2;
  const cut = through ? axisSize(size, axis) + 2 * OVERCUT : depth + OVERCUT;
  const entry = sign * (half + OVERCUT);
  return { depth: cut, center: entry - (sign * cut) / 2 };
}

export function toolSolidSpec(op: Operation, size: Size3): ToolSolidSpec {
  switch (op.type) {
    case 'roundHole': {
      const axis = axisOf(op.direction);
      const { depth, center } = holeAxisPlacement(axis, signOf(op.direction), size, op.through, op.depth);
      return {
        shape: 'cylinder',
        size: { x: op.diameter, y: depth, z: op.diameter },
        position: withAxis(op.position, axis, center),
        rotation: cylinderAlignRotation(axis),
      };
    }
    case 'rectHole': {
      const axis = axisOf(op.direction);
      const [ua, va] = otherAxes(axis);
      const { depth, center } = holeAxisPlacement(axis, signOf(op.direction), size, op.through, op.depth);
      let solid: Size3 = { x: 0, y: 0, z: 0 };
      solid = withAxisSize(solid, ua, op.width);
      solid = withAxisSize(solid, va, op.height);
      solid = withAxisSize(solid, axis, depth);
      return {
        shape: 'box',
        size: solid,
        position: withAxis(op.position, axis, center),
        rotation: withAxis([0, 0, 0], axis, op.rotation),
      };
    }
    case 'notch':
      return { shape: 'box', size: { ...op.size }, position: op.position, rotation: [0, 0, 0] };
    case 'cut': {
      // 残さない側の半空間を覆う巨大ボックスを減算する
      const big = Math.max(size.x, size.y, size.z) * 2 + 100;
      const removeSign = op.keep === 'negative' ? 1 : -1;
      return {
        shape: 'box',
        size: { x: big, y: big, z: big },
        position: withAxis([0, 0, 0], op.axis, op.offset + (removeSign * big) / 2),
        rotation: [0, 0, 0],
      };
    }
  }
}

/**
 * プレビュー表示用のツール立体。
 *
 * 切断のツールは「残さない側の半空間を覆う巨大ボックス」なので、そのまま描くと
 * 画面が赤一色になって何が削られるのか分からない。表示のときだけ部材の範囲に切り詰める。
 * CSG に渡すのは常に toolSolidSpec の方であり、形状の真実は 1 本のまま。
 */
export function previewSolidSpec(op: Operation, size: Size3): ToolSolidSpec {
  const spec = toolSolidSpec(op, size);
  if (op.type !== 'cut') return spec;

  const half = axisSize(size, op.axis) / 2;
  const removeTo = op.keep === 'negative' ? half : -half;
  const length = Math.abs(removeTo - op.offset);
  const [ua, va] = otherAxes(op.axis);

  let clamped: Size3 = { x: 0, y: 0, z: 0 };
  clamped = withAxisSize(clamped, op.axis, Math.max(length, 0.1));
  clamped = withAxisSize(clamped, ua, axisSize(size, ua) + 1);
  clamped = withAxisSize(clamped, va, axisSize(size, va) + 1);

  return {
    shape: 'box',
    size: clamped,
    position: withAxis([0, 0, 0], op.axis, (op.offset + removeTo) / 2),
    rotation: [0, 0, 0],
  };
}

/** ツール立体が占めるローカル AABB（検証・プレビューの当たり判定に使う） */
export function toolSolidBounds(spec: ToolSolidSpec): { min: Vec3; max: Vec3 } {
  // Ver.1 のツール立体は軸平行か、軸まわりの回転のみ。外接箱で十分。
  const r = Math.max(spec.size.x, spec.size.z);
  const half: Vec3 =
    spec.shape === 'cylinder'
      ? [r / 2, spec.size.y / 2, r / 2]
      : [spec.size.x / 2, spec.size.y / 2, spec.size.z / 2];
  const rotated = spec.rotation.some((d) => Math.abs(d % 180) > 1e-6);
  const m = rotated ? Math.max(half[0], half[1], half[2]) : 0;
  const h: Vec3 = rotated ? [m, m, m] : half;
  return {
    min: [spec.position[0] - h[0], spec.position[1] - h[1], spec.position[2] - h[2]],
    max: [spec.position[0] + h[0], spec.position[1] + h[1], spec.position[2] + h[2]],
  };
}

import { OVERCUT } from '../constants';
import { axisOf, axisSize, axisUnit, otherAxes, signOf, withAxis, withAxisSize } from '../math/axis';
import { axisAngleMatrix, matrixFromColumns, matrixToEuler, multiply } from '../math/matrix';
import { clean, cross, dot, negate } from '../math/vec3';
import type { ArchOperation, AxisKey, Operation, RoundCornerOperation, Size3, ToolSolidSpec, Vec3 } from '../types';

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

/**
 * アーチ断面（ツール座標系の XY 平面）を、部材ローカルの「方向軸に直交する面」へ向ける姿勢を作る。
 * 押し出し軸(+Z) を direction の軸へ、断面の上(+Y) を面内の第 2 軸へ合わせる。
 */
function archOrientation(axis: AxisKey, spinDeg: number): Vec3 {
  const [ua, va] = otherAxes(axis);
  let col0 = axisUnit(ua);
  const col1 = axisUnit(va);
  const col2 = axisUnit(axis);
  // 右手系でないと鏡像になる。断面は左右対称なので、幅の向きを反転して直す。
  if (dot(cross(col0, col1), col2) < 0) col0 = negate(col0);
  const basis = matrixFromColumns(col0, col1, col2);
  const spin = axisAngleMatrix(col2, spinDeg);
  return clean(matrixToEuler(multiply(spin, basis)), 4);
}

function archSolid(op: ArchOperation, size: Size3): ToolSolidSpec {
  const axis = axisOf(op.direction);
  const { depth, center } = holeAxisPlacement(axis, signOf(op.direction), size, op.through, op.depth);
  return {
    shape: 'arch',
    size: { x: op.width, y: op.height, z: depth },
    position: withAxis(op.position, axis, center),
    rotation: archOrientation(axis, op.rotation),
    rise: Math.min(Math.max(op.rise, 0), op.height),
  };
}

/**
 * 角丸のツール立体。
 *
 * 「素材の外形より少し大きい矩形」から「角を丸めた外形」をくり抜いた枠を押し出す。
 * こうすると 1 つの立体で四隅すべてを一度に落とせるし、丸めない角は枠が接しないので
 * 何も削られない。コーナーごとに立体を作るより、CSG に渡す形が単純になる。
 */
function roundCornerSolid(op: RoundCornerOperation, size: Size3): ToolSolidSpec {
  const axis = axisOf(op.direction);
  const [ua, va] = otherAxes(axis);
  const depth = axisSize(size, axis) + 2 * OVERCUT;
  return {
    shape: 'cornerFrame',
    size: { x: axisSize(size, ua), y: axisSize(size, va), z: depth },
    position: withAxis([0, 0, 0], axis, 0),
    rotation: archOrientation(axis, 0),
    corner: { radius: op.radius, keys: [...op.corners] },
  };
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
    case 'arch':
      return archSolid(op, size);
    case 'roundCorner':
      return roundCornerSolid(op, size);
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

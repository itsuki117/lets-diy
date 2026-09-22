import type { AxisDirection, AxisKey, Size3, Vec3 } from '../types';

export const axisOf = (dir: AxisDirection): AxisKey => dir[1] as AxisKey;
export const signOf = (dir: AxisDirection): 1 | -1 => (dir[0] === '+' ? 1 : -1);
export const axisIndex = (axis: AxisKey): 0 | 1 | 2 => (axis === 'x' ? 0 : axis === 'y' ? 1 : 2);
export const otherAxes = (axis: AxisKey): [AxisKey, AxisKey] =>
  axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];

/** 軸方向の単位ベクトル（符号なし） */
export const axisUnit = (axis: AxisKey): Vec3 =>
  axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];

export function dirToVec3(dir: AxisDirection): Vec3 {
  const s = signOf(dir);
  const axis = axisOf(dir);
  return axis === 'x' ? [s, 0, 0] : axis === 'y' ? [0, s, 0] : [0, 0, s];
}

/** Vec3 から軸の成分を取り出す（動的インデックスを使わない） */
export const axisValue = (v: Vec3, axis: AxisKey): number =>
  axis === 'x' ? v[0] : axis === 'y' ? v[1] : v[2];

/** Size3 から軸の寸法を取り出す */
export const axisSize = (s: Size3, axis: AxisKey): number =>
  axis === 'x' ? s.x : axis === 'y' ? s.y : s.z;

/** Vec3 の特定軸だけ差し替えた新しい Vec3 を返す */
export const withAxis = (v: Vec3, axis: AxisKey, value: number): Vec3 =>
  axis === 'x' ? [value, v[1], v[2]] : axis === 'y' ? [v[0], value, v[2]] : [v[0], v[1], value];

/** Size3 の特定軸だけ差し替えた新しい Size3 を返す */
export const withAxisSize = (s: Size3, axis: AxisKey, value: number): Size3 =>
  axis === 'x' ? { ...s, x: value } : axis === 'y' ? { ...s, y: value } : { ...s, z: value };

/** ベクトルに最も近い軸方向を返す */
export function nearestDirection(v: Vec3): AxisDirection {
  let best: AxisDirection = '+x';
  let bestAbs = -Infinity;
  for (const k of ['x', 'y', 'z'] as const) {
    const c = axisValue(v, k);
    if (Math.abs(c) > bestAbs) {
      bestAbs = Math.abs(c);
      best = `${c < 0 ? '-' : '+'}${k}` as AxisDirection;
    }
  }
  return best;
}

export const opposite = (dir: AxisDirection): AxisDirection =>
  `${dir[0] === '+' ? '-' : '+'}${dir[1]}` as AxisDirection;

/** 最も薄い軸（板材なら厚み方向） */
export function thinnestAxis(s: Size3): AxisKey {
  if (s.z <= s.x && s.z <= s.y) return 'z';
  return s.y <= s.x ? 'y' : 'x';
}

/** 最も長い軸 */
export function longestAxis(s: Size3): AxisKey {
  if (s.x >= s.y && s.x >= s.z) return 'x';
  return s.y >= s.z ? 'y' : 'z';
}

export const ALL_DIRECTIONS: AxisDirection[] = ['+x', '-x', '+y', '-y', '+z', '-z'];

export const DIRECTION_LABELS: Record<AxisDirection, string> = {
  '+x': '右面 (X+)',
  '-x': '左面 (X-)',
  '+y': '上面 (Y+)',
  '-y': '下面 (Y-)',
  '+z': '手前面 (Z+)',
  '-z': '奥面 (Z-)',
};

export const AXIS_LABELS: Record<AxisKey, string> = { x: 'X', y: 'Y', z: 'Z' };

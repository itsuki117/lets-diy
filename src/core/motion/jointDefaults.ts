import { DEFAULT_PRISMATIC_RANGE, DEFAULT_REVOLUTE_RANGE } from '../constants';
import { createJointId } from '../ids';
import { axisUnit, dirToVec3, nearestDirection } from '../math/axis';
import { worldToLocalPoint } from '../math/matrix';
import { sub } from '../math/vec3';
import type { Joint, JointKind, Part, Vec3 } from '../types';

/**
 * joint の初期値。
 *
 * ヒンジの軸は「動く側に最も近い固定側の面の縁」に垂直（base ローカル Y）で置く。
 * 実際の扉の蝶番の位置に近く、ユーザーが微調整しやすい。
 */

/** base ローカルでの、moving の中心の位置 */
function movingCenterInBase(base: Part, moving: Part): Vec3 {
  return worldToLocalPoint(base.transform, moving.transform.position);
}

/** base の外形の内側にクランプした点。軸を base の縁に寄せる。 */
function clampToBaseBox(base: Part, point: Vec3): Vec3 {
  const half: Vec3 = [base.size.x / 2, base.size.y / 2, base.size.z / 2];
  return [
    Math.min(Math.max(point[0], -half[0]), half[0]),
    Math.min(Math.max(point[1], -half[1]), half[1]),
    Math.min(Math.max(point[2], -half[2]), half[2]),
  ];
}

export function defaultJoint(kind: JointKind, base: Part, moving: Part, name?: string): Joint {
  const id = createJointId();
  const label = name ?? `${base.name} - ${moving.name}`;
  const common = { id, name: label, enabled: true, basePartId: base.id, movingPartId: moving.id };

  if (kind === 'fixed') return { ...common, kind: 'fixed' };

  const toMoving = movingCenterInBase(base, moving);

  if (kind === 'revolute') {
    return {
      ...common,
      kind: 'revolute',
      // 動く側に最も近い固定側の縁に軸を置く
      origin: clampToBaseBox(base, toMoving),
      axis: axisUnit('y'),
      value: 0,
      range: { ...DEFAULT_REVOLUTE_RANGE },
    };
  }

  // スライドは「固定側から動く側へ向かう向き」を軸に丸める
  const direction = nearestDirection(sub(toMoving, [0, 0, 0]));
  return {
    ...common,
    kind: 'prismatic',
    axis: dirToVec3(direction),
    value: 0,
    range: { ...DEFAULT_PRISMATIC_RANGE },
  };
}


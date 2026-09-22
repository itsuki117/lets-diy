import { localFaceCenter } from '../math/box';
import { axisOf, axisSize, axisUnit, dirToVec3, otherAxes } from '../math/axis';
import { localToWorldDir, localToWorldPoint, worldToLocalPoint } from '../math/matrix';
import { normalize } from '../math/vec3';
import type { AxisDirection, Part, Vec3 } from '../types';

export interface WorldFace {
  /** 外向き法線（単位ベクトル、ワールド） */
  normal: Vec3;
  /** 面の中心（ワールド） */
  center: Vec3;
  /** 面内の第1軸（ワールド、単位ベクトル） */
  u: Vec3;
  /** 面内の第2軸（ワールド、単位ベクトル） */
  v: Vec3;
  /** u 方向の半寸法 (mm) */
  halfU: number;
  /** v 方向の半寸法 (mm) */
  halfV: number;
}

export function worldFace(part: Part, dir: AxisDirection): WorldFace {
  const [ua, va] = otherAxes(axisOf(dir));
  return {
    normal: normalize(localToWorldDir(part.transform, dirToVec3(dir))),
    center: localToWorldPoint(part.transform, localFaceCenter(part.size, dir)),
    u: normalize(localToWorldDir(part.transform, axisUnit(ua))),
    v: normalize(localToWorldDir(part.transform, axisUnit(va))),
    halfU: axisSize(part.size, ua) / 2,
    halfV: axisSize(part.size, va) / 2,
  };
}

/**
 * ワールド上の点から、その点に最も近い部材の面を返す。
 * 加工でメッシュが変形していても「元の直方体のどの面か」を安定して返せる（設計書 §10.5）。
 */
export function pickFace(part: Part, worldPoint: Vec3): AxisDirection {
  const p = worldToLocalPoint(part.transform, worldPoint);
  const hx = part.size.x / 2, hy = part.size.y / 2, hz = part.size.z / 2;
  const candidates: Array<[AxisDirection, number]> = [
    ['+x', Math.abs(hx - p[0])],
    ['-x', Math.abs(p[0] + hx)],
    ['+y', Math.abs(hy - p[1])],
    ['-y', Math.abs(p[1] + hy)],
    ['+z', Math.abs(hz - p[2])],
    ['-z', Math.abs(p[2] + hz)],
  ];
  return candidates.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}

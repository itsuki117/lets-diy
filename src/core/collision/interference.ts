import { axisIndex, axisUnit } from '../math/axis';
import { localToWorldDir, localToWorldPoint } from '../math/matrix';
import { cross, dot, length, normalize, sub } from '../math/vec3';
import type { Part, PartId, Vec3 } from '../types';

/**
 * 干渉判定。
 *
 * 部材は直方体なので、有向境界ボックス（OBB）どうしの分離軸判定で正確に判定できる。
 * 穴や切り欠きは外形を変えないので無視してよいが、切断は外形が縮むので反映する。
 *
 * 面スナップでぴったり接した部材は「接触」であって干渉ではないため、
 * `tolerance` より深く食い込んでいるものだけを報告する。
 */

export interface Obb {
  /** 中心（ワールド） */
  center: Vec3;
  /** 3 本の単位軸（ワールド） */
  axes: [Vec3, Vec3, Vec3];
  /** 各軸方向の半寸法 */
  half: Vec3;
}

export interface InterferencePair {
  a: PartId;
  b: PartId;
  /** 食い込んでいる深さ mm */
  depthMm: number;
}

const EPS_AXIS = 1e-6;

/** 切断を反映した、部材ローカルでの外形ボックス */
export function effectiveLocalBox(part: Part): { min: Vec3; max: Vec3 } {
  const min: [number, number, number] = [-part.size.x / 2, -part.size.y / 2, -part.size.z / 2];
  const max: [number, number, number] = [part.size.x / 2, part.size.y / 2, part.size.z / 2];
  for (const op of part.operations) {
    if (!op.enabled || op.type !== 'cut') continue;
    const i = axisIndex(op.axis);
    if (op.keep === 'negative') max[i] = Math.min(max[i], op.offset);
    else min[i] = Math.max(min[i], op.offset);
  }
  // 切断で潰れてしまった場合でも、判定が壊れないよう最小厚みを残す
  const floor = (lo: number, hi: number): number => (hi - lo < 1e-4 ? lo + 1e-4 : hi);
  return {
    min,
    max: [floor(min[0], max[0]), floor(min[1], max[1]), floor(min[2], max[2])],
  };
}

export function partObb(part: Part): Obb {
  const box = effectiveLocalBox(part);
  const localCenter: Vec3 = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
  return {
    center: localToWorldPoint(part.transform, localCenter),
    axes: [
      normalize(localToWorldDir(part.transform, axisUnit('x'))),
      normalize(localToWorldDir(part.transform, axisUnit('y'))),
      normalize(localToWorldDir(part.transform, axisUnit('z'))),
    ],
    half: [
      (box.max[0] - box.min[0]) / 2,
      (box.max[1] - box.min[1]) / 2,
      (box.max[2] - box.min[2]) / 2,
    ],
  };
}

const projectedRadius = (obb: Obb, axis: Vec3): number =>
  Math.abs(dot(obb.axes[0], axis)) * obb.half[0] +
  Math.abs(dot(obb.axes[1], axis)) * obb.half[1] +
  Math.abs(dot(obb.axes[2], axis)) * obb.half[2];

/**
 * 2 つの OBB の食い込み深さ。離れていれば null。
 * 分離軸定理の 15 軸（各 3 軸 + 外積 9 本）をすべて調べ、最小の重なり量を返す。
 */
export function obbPenetration(a: Obb, b: Obb): number | null {
  const delta = sub(b.center, a.center);
  const candidates: Vec3[] = [...a.axes, ...b.axes];
  for (const axisA of a.axes) {
    for (const axisB of b.axes) {
      const c = cross(axisA, axisB);
      if (length(c) > EPS_AXIS) candidates.push(normalize(c));
    }
  }

  let minOverlap = Infinity;
  for (const axis of candidates) {
    const overlap = projectedRadius(a, axis) + projectedRadius(b, axis) - Math.abs(dot(delta, axis));
    if (overlap <= 0) return null;
    if (overlap < minOverlap) minOverlap = overlap;
  }
  return minOverlap;
}

/**
 * 部材どうしの干渉を全部調べる。
 * `tolerance`（既定 0.5mm）以下の食い込みは、面スナップの接触とみなして報告しない。
 */
export function findInterferences(parts: readonly Part[], tolerance = 0.5): InterferencePair[] {
  const visible = parts.filter((p) => p.visible);
  const obbs = new Map<PartId, Obb>(visible.map((p) => [p.id, partObb(p)]));
  const found: InterferencePair[] = [];

  for (let i = 0; i < visible.length; i += 1) {
    for (let j = i + 1; j < visible.length; j += 1) {
      const a = visible[i]!;
      const b = visible[j]!;
      const depth = obbPenetration(obbs.get(a.id)!, obbs.get(b.id)!);
      if (depth === null || depth <= tolerance) continue;
      found.push({ a: a.id, b: b.id, depthMm: Math.round(depth * 100) / 100 });
    }
  }

  return found.sort((x, y) => y.depthMm - x.depthMm);
}

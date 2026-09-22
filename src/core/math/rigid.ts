import type { Transform, Vec3 } from '../types';
import {
  applyMat3,
  axisAngleMatrix,
  IDENTITY,
  matrixToEuler,
  multiply,
  rotationMatrix,
  transpose,
  type Mat3,
} from './matrix';
import { add, negate, normalize, scale } from './vec3';

/**
 * 剛体変換（回転 + 平行移動）。スケールは扱わない。
 *
 * 4x4 行列を持たずに Mat3 + Vec3 で表すのは、Ver.1 で作った回転行列の実装を
 * そのまま使い回せるため。合成と逆変換だけ足せば運動学に足りる。
 */
export interface Rigid {
  rotation: Mat3;
  translation: Vec3;
}

export const IDENTITY_RIGID: Rigid = { rotation: IDENTITY, translation: [0, 0, 0] };

export const rigidFromTransform = (transform: Transform): Rigid => ({
  rotation: rotationMatrix(transform.rotation),
  translation: transform.position,
});

export const rigidToTransform = (rigid: Rigid): Transform => ({
  position: rigid.translation,
  rotation: matrixToEuler(rigid.rotation),
});

/** a のあとに b を適用する（行列でいう a * b） */
export const composeRigid = (a: Rigid, b: Rigid): Rigid => ({
  rotation: multiply(a.rotation, b.rotation),
  translation: add(applyMat3(a.rotation, b.translation), a.translation),
});

export function invertRigid(a: Rigid): Rigid {
  const inverse = transpose(a.rotation);
  return { rotation: inverse, translation: negate(applyMat3(inverse, a.translation)) };
}

export const applyRigid = (r: Rigid, point: Vec3): Vec3 => add(applyMat3(r.rotation, point), r.translation);

export const rigidTranslation = (offset: Vec3): Rigid => ({ rotation: IDENTITY, translation: offset });

/** 点 origin を通る軸まわりの回転 */
export function rigidRotationAround(origin: Vec3, axis: Vec3, deg: number): Rigid {
  const unit = normalize(axis);
  const rotation = axisAngleMatrix(unit, deg);
  // T(origin) * R * T(-origin)
  return { rotation, translation: add(origin, negate(applyMat3(rotation, origin))) };
}

/** 軸方向へ distance mm だけ進む */
export const rigidSlide = (axis: Vec3, distance: number): Rigid =>
  rigidTranslation(scale(normalize(axis), distance));

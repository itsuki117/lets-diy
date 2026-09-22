import { AppError } from '../result';
import { axisAngleMatrix, matrixToEuler, multiply, rotationMatrix } from '../math/matrix';
import { axisUnit, nearestDirection, axisOf, dirToVec3 } from '../math/axis';
import { add, cross, dot, length, negate, normalize, scale, sub, clean } from '../math/vec3';
import { worldFace } from '../part/partFaces';
import type { AxisDirection, Millimeter, Part, Transform, Vec3 } from '../types';

export interface FaceSnapArgs {
  /** 動かす部材 */
  source: Part;
  sourceFace: AxisDirection;
  /** 固定側の部材 */
  target: Part;
  targetFace: AxisDirection;
  /** 面と面の隙間 mm。負値はめり込み。 */
  gap: Millimeter;
  /** 法線に直交する 2 軸でも面中心を揃えるか */
  centerAlign: boolean;
}

/**
 * nA を to に一致させる回転を 90 度単位で求める（設計書 §12.4 手順 2）。
 * Ver.1 は軸整列に限定することで、計算を安定させている。
 */
function alignAxisRotation(from: Vec3, to: Vec3): ReturnType<typeof rotationMatrix> {
  const a = normalize(from);
  const b = normalize(to);
  const d = Math.min(1, Math.max(-1, dot(a, b)));
  if (d > 0.9999) return rotationMatrix([0, 0, 0]);
  if (d < -0.9999) {
    // 正反対。a に直交する主軸まわりに 180 度回す。
    const primary = axisOf(nearestDirection(a));
    const perp = primary === 'x' ? axisUnit('y') : axisUnit('x');
    return axisAngleMatrix(normalize(cross(a, perp)), 180);
  }
  const rawAxis = cross(a, b);
  if (length(rawAxis) < 1e-9) return rotationMatrix([0, 0, 0]);
  const snappedAxis = dirToVec3(nearestDirection(rawAxis));
  const angle = Math.round((Math.acos(d) * 180) / Math.PI / 90) * 90;
  return axisAngleMatrix(normalize(snappedAxis), angle);
}

/**
 * 面スナップ後の Transform を求める。
 *
 * gap の符号: nB は target の外向き法線なので、source の目標平面は pB + nB * gap。
 * よって d = dot(pB - pA, nB) + gap（設計書 §12.4 の符号注記）。
 */
export function computeFaceSnapTransform(args: FaceSnapArgs): Transform {
  const { source, sourceFace, target, targetFace, gap, centerAlign } = args;
  if (source.id === target.id) {
    throw new AppError('INVALID_INPUT', '同じ部材の面どうしはスナップできません');
  }

  const fa = worldFace(source, sourceFace);
  const fb = worldFace(target, targetFace);

  // 1. 姿勢合わせ: source の面法線を target の面法線の逆向きへ
  const alignR = alignAxisRotation(fa.normal, negate(fb.normal));
  const rotated = multiply(alignR, rotationMatrix(source.transform.rotation));
  const rotation = clean(matrixToEuler(rotated), 4);

  // 2. 回転後の面中心を求め直す（回転は原点まわりなので位置は据え置きで計算）
  const oriented: Part = { ...source, transform: { position: source.transform.position, rotation } };
  const faOriented = worldFace(oriented, sourceFace);

  // 3. 法線方向の移動
  const delta = sub(fb.center, faOriented.center);
  let position = add(source.transform.position, scale(fb.normal, dot(delta, fb.normal) + gap));

  // 4. 面内 2 軸の中心合わせ（任意）
  if (centerAlign) {
    const after = worldFace({ ...oriented, transform: { position, rotation } }, sourceFace);
    const d2 = sub(fb.center, after.center);
    position = add(position, scale(fb.u, dot(d2, fb.u)));
    position = add(position, scale(fb.v, dot(d2, fb.v)));
  }

  return { position: clean(position, 4), rotation };
}

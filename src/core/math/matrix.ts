import type { Degree, Transform, Vec3 } from '../types';
import { degToRad, normalizeDeg, radToDeg } from './angle';
import { add, sub } from './vec3';

/** 行優先の 3x3 回転行列 [m11,m12,m13, m21,m22,m23, m31,m32,m33] */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Euler XYZ（度）から回転行列を作る。
 * three.js の Euler order 'XYZ'（R = Rx * Ry * Rz）と一致させること。
 * ここがずれると core の計算と画面表示が食い違う。
 */
export function rotationMatrix(rotation: Vec3): Mat3 {
  const x = degToRad(rotation[0]);
  const y = degToRad(rotation[1]);
  const z = degToRad(rotation[2]);
  const c1 = Math.cos(x), s1 = Math.sin(x);
  const c2 = Math.cos(y), s2 = Math.sin(y);
  const c3 = Math.cos(z), s3 = Math.sin(z);
  return [
    c2 * c3, -c2 * s3, s2,
    c1 * s3 + c3 * s1 * s2, c1 * c3 - s1 * s2 * s3, -c2 * s1,
    s1 * s3 - c1 * c3 * s2, c3 * s1 + c1 * s2 * s3, c1 * c2,
  ];
}

/** 回転行列から Euler XYZ（度）へ。three.js の setFromRotationMatrix('XYZ') と同じ分解。 */
export function matrixToEuler(m: Mat3): Vec3 {
  const y = Math.asin(Math.min(1, Math.max(-1, m[2])));
  let x: number;
  let z: number;
  if (Math.abs(m[2]) < 0.9999999) {
    x = Math.atan2(-m[5], m[8]);
    z = Math.atan2(-m[1], m[0]);
  } else {
    x = Math.atan2(m[7], m[4]);
    z = 0;
  }
  return [normalizeDeg(radToDeg(x)), normalizeDeg(radToDeg(y)), normalizeDeg(radToDeg(z))];
}

export function multiply(a: Mat3, b: Mat3): Mat3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

export const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

export function applyMat3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** 軸まわりの回転行列（角度は度） */
export function axisAngleMatrix(axis: Vec3, deg: Degree): Mat3 {
  const [x, y, z] = axis;
  const a = degToRad(deg);
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    t * x * x + c, t * x * y - s * z, t * x * z + s * y,
    t * x * y + s * z, t * y * y + c, t * y * z - s * x,
    t * x * z - s * y, t * y * z + s * x, t * z * z + c,
  ];
}

export const localToWorldDir = (transform: Transform, dir: Vec3): Vec3 =>
  applyMat3(rotationMatrix(transform.rotation), dir);

export const localToWorldPoint = (transform: Transform, p: Vec3): Vec3 =>
  add(applyMat3(rotationMatrix(transform.rotation), p), transform.position);

export const worldToLocalPoint = (transform: Transform, p: Vec3): Vec3 =>
  applyMat3(transpose(rotationMatrix(transform.rotation)), sub(p, transform.position));

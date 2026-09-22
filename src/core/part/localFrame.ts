import type { Size3, Vec3 } from '../types';

/**
 * コーナー原点（X-, Y-, Z- 側の角）から中心原点ローカル座標へ。
 * UI はコーナー原点で入力させ、保存は中心原点で行う（設計書 §4.5）。
 */
export const cornerToLocal = (size: Size3, p: Vec3): Vec3 => [
  p[0] - size.x / 2,
  p[1] - size.y / 2,
  p[2] - size.z / 2,
];

/** 中心原点ローカル座標からコーナー原点へ */
export const localToCorner = (size: Size3, p: Vec3): Vec3 => [
  p[0] + size.x / 2,
  p[1] + size.y / 2,
  p[2] + size.z / 2,
];

import type { MaterialKind, Size3, SnapSettings } from './types';
// src/core/constants.ts
export const SCENE_SCALE = 1;          // 1 Three.js unit = 1 mm

export const EPS = 1e-6;
export const OVERCUT = 0.5;            // CSG コプラナー回避のはみ出し量 (mm)

export const MIN_SIZE_MM = 0.1;
export const MAX_SIZE_MM = 5000;
export const MIN_DIAMETER_MM = 0.5;

export const HISTORY_LIMIT = 100;
export const AUTOSAVE_DEBOUNCE_MS = 1000;

export const DEFAULT_SNAP: SnapSettings = { grid: 10, angle: 90 };

export const DEFAULT_PART_SIZE: Size3 = { x: 600, y: 300, z: 18 };

export const MATERIAL_PRESETS = [
  { label: '合板 t12',  size: { x: 600, y: 300, z: 12 }, material: 'plywood' },
  { label: '合板 t15',  size: { x: 600, y: 300, z: 15 }, material: 'plywood' },
  { label: '合板 t18',  size: { x: 600, y: 300, z: 18 }, material: 'plywood' },
  { label: '合板 t21',  size: { x: 600, y: 300, z: 21 }, material: 'plywood' },
  { label: 'SPF 1x4',   size: { x: 1820, y: 89, z: 19 }, material: 'pine' },
  { label: 'SPF 2x4',   size: { x: 1820, y: 89, z: 38 }, material: 'pine' },
  { label: '集成材 t25', size: { x: 900, y: 300, z: 25 }, material: 'pine' },
] as const;

export const CYLINDER_SEGMENTS = 24;   // 丸穴の分割数

export const MATERIAL_LABELS: Record<MaterialKind, string> = {
  plywood: '合板',
  pine: '松・SPF',
  lauan: 'ラワン',
  mdf: 'MDF',
  generic: 'その他',
};

// ============================================================
// Ver.2 追加分
// ============================================================

/** 材質ごとの密度 kg/m3。ガススプリングの計算に使う概算値 */
export const MATERIAL_DENSITY: Record<MaterialKind, number> = {
  plywood: 600,
  pine: 450,
  lauan: 450,
  mdf: 750,
  generic: 550,
};

/** 鋸刃の幅 mm。木取り図でピースの間に入れる */
export const DEFAULT_KERF_MM = 3;

/** 可動範囲の干渉走査の分割数 */
export const MOTION_SCAN_STEPS = 36;

/** ガススプリングの計算の分割数 */
export const GAS_SPRING_STEPS = 24;

/** 重力加速度 m/s2 */
export const GRAVITY = 9.81;

/** 定尺板のプリセット */
export const STOCK_SHEETS = [
  { id: 'sanroku', label: 'サブロク 910x1820', width: 910, height: 1820 },
  { id: 'shiroku', label: 'シハチ 1230x2430', width: 1230, height: 2430 },
  { id: 'half', label: 'ハーフ 910x910', width: 910, height: 910 },
] as const;

/** joint の既定の可動範囲 */
export const DEFAULT_REVOLUTE_RANGE = { min: 0, max: 110 };
export const DEFAULT_PRISMATIC_RANGE = { min: 0, max: 350 };

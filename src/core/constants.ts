import type { Size3, SnapSettings } from './types';
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

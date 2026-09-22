import type { CornerKey } from '../types';

/** 面内 (u, v) の最小側を 左/下、最大側を 右/上 と呼ぶ */
export const CORNER_LABELS: Record<CornerKey, string> = {
  bottomLeft: '左下',
  bottomRight: '右下',
  topLeft: '左上',
  topRight: '右上',
};

/** UI の 2x2 グリッド順（上段から下段へ） */
export const CORNER_GRID: CornerKey[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

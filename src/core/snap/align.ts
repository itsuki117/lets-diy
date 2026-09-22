import { axisValue, withAxis } from '../math/axis';
import { worldAabb } from '../part/partBounds';
import type { AlignAnchor, AxisKey, Part, PartId, Vec3 } from '../types';

/**
 * 選択部材を軸ごとに揃える。回転は変更せず、その軸方向にだけ平行移動する。
 * エッジスナップの代わりに Ver.1 で提供する機能（設計書 §12.5）。
 */
export function computeAlignedPositions(
  parts: readonly Part[],
  axis: AxisKey,
  anchor: AlignAnchor,
): Map<PartId, Vec3> {
  const out = new Map<PartId, Vec3>();
  if (parts.length < 2) return out;

  const boxes = parts.map((p) => ({ part: p, box: worldAabb(p) }));
  const mins = boxes.map((b) => axisValue(b.box.min, axis));
  const maxs = boxes.map((b) => axisValue(b.box.max, axis));
  const groupMin = Math.min(...mins);
  const groupMax = Math.max(...maxs);
  const target = anchor === 'min' ? groupMin : anchor === 'max' ? groupMax : (groupMin + groupMax) / 2;

  for (const { part, box } of boxes) {
    const lo = axisValue(box.min, axis);
    const hi = axisValue(box.max, axis);
    const current = anchor === 'min' ? lo : anchor === 'max' ? hi : (lo + hi) / 2;
    const delta = target - current;
    if (Math.abs(delta) < 1e-9) continue;
    const pos = part.transform.position;
    out.set(part.id, withAxis(pos, axis, axisValue(pos, axis) + delta));
  }
  return out;
}
